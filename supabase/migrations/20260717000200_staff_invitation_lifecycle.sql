-- PetCare E02 staff invitation lifecycle.
-- Raw invitation tokens are returned once and never stored. Only SHA-256 digests persist.

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  email text not null check (
    email = lower(trim(email))
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
  ),
  token_digest bytea not null unique check (octet_length(token_digest) = 32),
  state text not null default 'pending'
    check (state in ('pending', 'accepted', 'revoked', 'expired', 'superseded')),
  location_scope_mode text not null default 'selected'
    check (location_scope_mode in ('all_current', 'selected')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.identity_profiles (id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.identity_profiles (id) on delete restrict,
  created_by uuid not null references public.identity_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  check (expires_at > created_at),
  check (
    (state = 'accepted' and accepted_at is not null and accepted_by is not null)
    or (state <> 'accepted' and accepted_at is null and accepted_by is null)
  ),
  check (
    (state = 'revoked' and revoked_at is not null and revoked_by is not null)
    or (state <> 'revoked' and revoked_at is null and revoked_by is null)
  )
);

create unique index staff_invitations_one_pending_email_idx
  on public.staff_invitations (business_id, email)
  where state = 'pending';
create index staff_invitations_business_state_idx
  on public.staff_invitations (business_id, state, expires_at, created_at desc);

create table public.staff_invitation_roles (
  business_id uuid not null,
  invitation_id uuid not null,
  role_key text not null references public.role_definitions (role_key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (business_id, invitation_id, role_key),
  foreign key (business_id, invitation_id)
    references public.staff_invitations (business_id, id) on delete cascade
);

create table public.staff_invitation_location_scopes (
  business_id uuid not null,
  invitation_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (business_id, invitation_id, location_id),
  foreign key (business_id, invitation_id)
    references public.staff_invitations (business_id, id) on delete cascade,
  foreign key (business_id, location_id)
    references public.locations (business_id, id) on delete cascade
);

comment on table public.staff_invitations is
  'Purpose-bound, expiring, single-use staff invitations. Raw invitation tokens must never be persisted.';

create trigger staff_invitations_set_updated_at
before update on public.staff_invitations
for each row execute function app.set_updated_at();

create trigger staff_invitations_prevent_business_change
before update on public.staff_invitations
for each row execute function app.prevent_business_id_change();

create trigger staff_invitation_roles_prevent_business_change
before update on public.staff_invitation_roles
for each row execute function app.prevent_business_id_change();

create trigger staff_invitation_location_scopes_prevent_business_change
before update on public.staff_invitation_location_scopes
for each row execute function app.prevent_business_id_change();

create or replace function app.current_auth_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
$$;

create or replace function app.session_has_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function app.create_staff_invitation(
  target_business_id uuid,
  target_email text,
  target_role_keys text[],
  target_location_scope_mode text default 'selected',
  target_location_ids uuid[] default array[]::uuid[],
  target_expires_in interval default interval '7 days'
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := lower(trim(target_email));
  normalized_roles text[];
  normalized_locations uuid[];
  raw_token text;
  created_invitation_id uuid;
  created_expires_at timestamptz;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not app.member_has_permission(target_business_id, 'staff.invite') then
    raise exception 'invitation not permitted' using errcode = '42501';
  end if;
  if normalized_email is null or char_length(normalized_email) < 3
    or char_length(normalized_email) > 320 or position('@' in normalized_email) <= 1 then
    raise exception 'valid invitation email required' using errcode = '22023';
  end if;
  if target_location_scope_mode not in ('all_current', 'selected') then
    raise exception 'invalid location scope mode' using errcode = '22023';
  end if;
  if target_expires_in < interval '1 hour' or target_expires_in > interval '30 days' then
    raise exception 'invitation expiry must be between one hour and thirty days' using errcode = '22023';
  end if;

  select coalesce(array_agg(role_key order by role_key), array[]::text[])
  into normalized_roles
  from (select distinct unnest(coalesce(target_role_keys, array[]::text[])) as role_key) roles;

  if cardinality(normalized_roles) = 0 then
    raise exception 'at least one role required' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(normalized_roles) requested(role_key)
    left join public.role_definitions role on role.role_key = requested.role_key
    where role.role_key is null
  ) then
    raise exception 'unknown role requested' using errcode = '22023';
  end if;
  if 'owner' = any(normalized_roles) and not app.session_has_aal2() then
    raise exception 'owner invitations require MFA step-up' using errcode = '42501';
  end if;

  select coalesce(array_agg(location_id order by location_id), array[]::uuid[])
  into normalized_locations
  from (select distinct unnest(coalesce(target_location_ids, array[]::uuid[])) as location_id) locations;

  if target_location_scope_mode = 'selected' and cardinality(normalized_locations) = 0 then
    raise exception 'selected scope requires at least one location' using errcode = '22023';
  end if;
  if target_location_scope_mode = 'all_current' and cardinality(normalized_locations) <> 0 then
    raise exception 'all-current scope cannot include selected locations' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(normalized_locations) requested(location_id)
    left join public.locations location
      on location.business_id = target_business_id and location.id = requested.location_id
    where location.id is null
  ) then
    raise exception 'location does not belong to business' using errcode = '22023';
  end if;

  update public.staff_invitations
  set state = 'superseded'
  where business_id = target_business_id and email = normalized_email and state = 'pending';

  raw_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  created_expires_at := now() + target_expires_in;

  insert into public.staff_invitations (
    business_id, email, token_digest, location_scope_mode, expires_at, created_by
  ) values (
    target_business_id,
    normalized_email,
    extensions.digest(raw_token, 'sha256'),
    target_location_scope_mode,
    created_expires_at,
    actor_id
  ) returning id into created_invitation_id;

  insert into public.staff_invitation_roles (business_id, invitation_id, role_key)
  select target_business_id, created_invitation_id, role_key from unnest(normalized_roles) role_key;

  if target_location_scope_mode = 'selected' then
    insert into public.staff_invitation_location_scopes (business_id, invitation_id, location_id)
    select target_business_id, created_invitation_id, location_id from unnest(normalized_locations) location_id;
  end if;

  perform app.write_audit_event(
    target_business_id, actor_id, 'staff.invitation_created', 'staff_invitation',
    created_invitation_id,
    jsonb_build_object(
      'email', normalized_email,
      'roles', to_jsonb(normalized_roles),
      'location_scope_mode', target_location_scope_mode,
      'expires_at', created_expires_at
    )
  );

  return query select created_invitation_id, raw_token, created_expires_at;
end;
$$;

create or replace function app.accept_staff_invitation(invitation_token text)
returns table (business_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text := app.current_auth_email();
  invitation public.staff_invitations%rowtype;
  created_membership_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if invitation_token is null or char_length(invitation_token) < 32 then
    raise exception 'invitation unavailable' using errcode = '22023';
  end if;

  select * into invitation
  from public.staff_invitations
  where token_digest = extensions.digest(invitation_token, 'sha256')
  for update;

  if not found or invitation.state <> 'pending' then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  if actor_email is null or actor_email <> invitation.email then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.identity_profiles identity
    where identity.id = actor_id and identity.status = 'active'
  ) then
    raise exception 'active verified identity required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.staff_invitation_roles role
    join public.role_definitions definition on definition.role_key = role.role_key
    where role.business_id = invitation.business_id
      and role.invitation_id = invitation.id
      and definition.requires_mfa
  ) and not app.session_has_aal2() then
    raise exception 'invited role requires MFA' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.business_memberships membership
    where membership.business_id = invitation.business_id
      and membership.identity_id = actor_id
      and membership.state = 'active'
  ) then
    raise exception 'identity already has active membership' using errcode = '23505';
  end if;

  insert into public.business_memberships (
    business_id, identity_id, state, location_scope_mode,
    invited_at, activated_at, created_by
  ) values (
    invitation.business_id, actor_id, 'active', invitation.location_scope_mode,
    invitation.created_at, now(), invitation.created_by
  )
  on conflict (business_id, identity_id) do update
  set state = 'active',
      location_scope_mode = excluded.location_scope_mode,
      invited_at = excluded.invited_at,
      activated_at = now(),
      suspended_at = null,
      revoked_at = null,
      ended_at = null
  returning id into created_membership_id;

  delete from public.membership_roles
  where business_id = invitation.business_id and membership_id = created_membership_id;
  insert into public.membership_roles (business_id, membership_id, role_key, assigned_by)
  select invitation.business_id, created_membership_id, role.role_key, invitation.created_by
  from public.staff_invitation_roles role
  where role.business_id = invitation.business_id and role.invitation_id = invitation.id;

  delete from public.membership_location_scopes
  where business_id = invitation.business_id and membership_id = created_membership_id;
  if invitation.location_scope_mode = 'selected' then
    insert into public.membership_location_scopes (
      business_id, membership_id, location_id, assigned_by
    )
    select invitation.business_id, created_membership_id, scope.location_id, invitation.created_by
    from public.staff_invitation_location_scopes scope
    where scope.business_id = invitation.business_id and scope.invitation_id = invitation.id;
  end if;

  update public.staff_invitations
  set state = 'accepted', accepted_at = now(), accepted_by = actor_id
  where id = invitation.id;

  perform app.write_audit_event(
    invitation.business_id, actor_id, 'staff.invitation_accepted', 'staff_invitation',
    invitation.id, jsonb_build_object('membership_id', created_membership_id)
  );

  return query select invitation.business_id, created_membership_id;
end;
$$;

create or replace function app.revoke_staff_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  invitation public.staff_invitations%rowtype;
begin
  select * into invitation from public.staff_invitations where id = target_invitation_id;
  if not found or not app.member_has_permission(invitation.business_id, 'staff.invite') then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  if invitation.state <> 'pending' then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;

  update public.staff_invitations
  set state = 'revoked', revoked_at = now(), revoked_by = actor_id
  where id = invitation.id;

  perform app.write_audit_event(
    invitation.business_id, actor_id, 'staff.invitation_revoked', 'staff_invitation',
    invitation.id, '{}'::jsonb
  );
end;
$$;

create or replace function app.expire_staff_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer := 0;
  expired_invitation record;
begin
  for expired_invitation in
    update public.staff_invitations
    set state = 'expired'
    where state = 'pending' and expires_at <= now()
    returning id, business_id
  loop
    expired_count := expired_count + 1;
    perform app.write_audit_event(
      expired_invitation.business_id, null, 'staff.invitation_expired',
      'staff_invitation', expired_invitation.id, '{}'::jsonb
    );
  end loop;
  return expired_count;
end;
$$;

alter table public.staff_invitations enable row level security;
alter table public.staff_invitations force row level security;
alter table public.staff_invitation_roles enable row level security;
alter table public.staff_invitation_roles force row level security;
alter table public.staff_invitation_location_scopes enable row level security;
alter table public.staff_invitation_location_scopes force row level security;

create policy staff_invitations_select_manager
on public.staff_invitations for select to authenticated
using (app.member_has_permission(business_id, 'staff.invite'));

create policy staff_invitation_roles_select_manager
on public.staff_invitation_roles for select to authenticated
using (app.member_has_permission(business_id, 'staff.invite'));

create policy staff_invitation_location_scopes_select_manager
on public.staff_invitation_location_scopes for select to authenticated
using (app.member_has_permission(business_id, 'staff.invite'));

revoke all on public.staff_invitations from anon, authenticated;
revoke all on public.staff_invitation_roles from anon, authenticated;
revoke all on public.staff_invitation_location_scopes from anon, authenticated;
grant select on public.staff_invitations to authenticated;
grant select on public.staff_invitation_roles to authenticated;
grant select on public.staff_invitation_location_scopes to authenticated;

revoke all on function app.current_auth_email() from public;
revoke all on function app.session_has_aal2() from public;
revoke all on function app.create_staff_invitation(uuid, text, text[], text, uuid[], interval) from public;
revoke all on function app.accept_staff_invitation(text) from public;
revoke all on function app.revoke_staff_invitation(uuid) from public;
revoke all on function app.expire_staff_invitations() from public;

grant execute on function app.current_auth_email() to authenticated;
grant execute on function app.session_has_aal2() to authenticated;
grant execute on function app.create_staff_invitation(uuid, text, text[], text, uuid[], interval) to authenticated;
grant execute on function app.accept_staff_invitation(text) to authenticated;
grant execute on function app.revoke_staff_invitation(uuid) to authenticated;
