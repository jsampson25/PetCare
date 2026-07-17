-- PetCare E02 identity, business membership, role, location scope, audit, and RLS foundation.
-- Authentication secrets remain owned by Supabase Auth; application authorization remains relational.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

create table public.identity_profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  preferred_name text check (preferred_name is null or char_length(trim(preferred_name)) between 1 and 80),
  status text not null default 'active'
    check (status in ('pending_verification', 'active', 'locked', 'disabled', 'recovery_review', 'archived')),
  locale text not null default 'en-US' check (char_length(locale) between 2 and 35),
  time_zone text not null default 'America/Chicago' check (char_length(time_zone) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.identity_profiles is
  'Application-owned identity state and presentation linked one-to-one to Supabase Auth.';

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  public_slug text not null unique
    check (public_slug = lower(public_slug) and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  created_by uuid not null references public.identity_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.businesses is
  'Security tenant. Locations are scopes inside a business, never separate tenants.';

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  public_slug text not null
    check (public_slug = lower(public_slug) and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  status text not null default 'active'
    check (status in ('draft', 'active', 'inactive', 'archived')),
  created_by uuid not null references public.identity_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, public_slug)
);

create index locations_business_status_idx on public.locations (business_id, status, created_at);

create table public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  identity_id uuid not null references public.identity_profiles (id) on delete restrict,
  state text not null default 'invited'
    check (state in ('invited', 'active', 'suspended', 'revoked', 'ended', 'expired')),
  location_scope_mode text not null default 'selected'
    check (location_scope_mode in ('all_current', 'selected')),
  invited_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.identity_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, identity_id),
  check ((state <> 'active') or activated_at is not null)
);

create index business_memberships_identity_state_idx
  on public.business_memberships (identity_id, state, business_id);
create index business_memberships_business_state_idx
  on public.business_memberships (business_id, state, created_at);

create table public.permission_definitions (
  permission_key text primary key check (permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  description text not null,
  risk_level text not null default 'standard' check (risk_level in ('standard', 'sensitive', 'high')),
  created_at timestamptz not null default now()
);

create table public.role_definitions (
  role_key text primary key check (role_key ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null unique,
  description text not null,
  requires_mfa boolean not null default false,
  sort_order smallint not null unique check (sort_order > 0),
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_key text not null references public.role_definitions (role_key) on delete restrict,
  permission_key text not null references public.permission_definitions (permission_key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  membership_id uuid not null,
  role_key text not null references public.role_definitions (role_key) on delete restrict,
  assigned_by uuid references public.identity_profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, membership_id, role_key),
  foreign key (business_id, membership_id)
    references public.business_memberships (business_id, id) on delete cascade
);

create index membership_roles_membership_idx
  on public.membership_roles (business_id, membership_id, role_key);

create table public.membership_location_scopes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  membership_id uuid not null,
  location_id uuid not null,
  assigned_by uuid references public.identity_profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, membership_id, location_id),
  foreign key (business_id, membership_id)
    references public.business_memberships (business_id, id) on delete cascade,
  foreign key (business_id, location_id)
    references public.locations (business_id, id) on delete cascade
);

create index membership_location_scopes_membership_idx
  on public.membership_location_scopes (business_id, membership_id, location_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  actor_identity_id uuid references public.identity_profiles (id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  entity_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index audit_events_business_time_idx
  on public.audit_events (business_id, occurred_at desc, id);
create index audit_events_business_entity_idx
  on public.audit_events (business_id, entity_type, entity_id, occurred_at desc);

comment on table public.audit_events is
  'Append-only tenant audit events. Credentials, secrets, and raw sensitive payloads are prohibited.';

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app.prevent_business_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'business_id is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger identity_profiles_set_updated_at
before update on public.identity_profiles
for each row execute function app.set_updated_at();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function app.set_updated_at();

create trigger locations_set_updated_at
before update on public.locations
for each row execute function app.set_updated_at();

create trigger business_memberships_set_updated_at
before update on public.business_memberships
for each row execute function app.set_updated_at();

create trigger locations_prevent_business_change
before update on public.locations
for each row execute function app.prevent_business_id_change();

create trigger business_memberships_prevent_business_change
before update on public.business_memberships
for each row execute function app.prevent_business_id_change();

create trigger membership_roles_prevent_business_change
before update on public.membership_roles
for each row execute function app.prevent_business_id_change();

create trigger membership_location_scopes_prevent_business_change
before update on public.membership_location_scopes
for each row execute function app.prevent_business_id_change();

create trigger audit_events_prevent_business_change
before update on public.audit_events
for each row execute function app.prevent_business_id_change();

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.identity_profiles as profile (id, display_name, status)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    case when new.email_confirmed_at is null then 'pending_verification' else 'active' end
  )
  on conflict (id) do update
  set status = case
    when profile.status = 'pending_verification'
      and new.email_confirmed_at is not null then 'active'
    else profile.status
  end;
  return new;
end;
$$;

create trigger auth_user_created_create_identity_profile
after insert on auth.users
for each row execute function app.handle_new_auth_user();

create trigger auth_user_verified_activate_identity_profile
after update of email_confirmed_at on auth.users
for each row execute function app.handle_new_auth_user();

insert into public.permission_definitions (permission_key, description, risk_level) values
  ('audit.view', 'View tenant audit history.', 'sensitive'),
  ('bookings.cancel', 'Cancel bookings when domain policy permits.', 'sensitive'),
  ('bookings.create', 'Create bookings.', 'standard'),
  ('bookings.modify', 'Modify bookings when domain policy permits.', 'standard'),
  ('bookings.view', 'View bookings within effective scope.', 'standard'),
  ('business.manage_locations', 'Create and manage business locations.', 'high'),
  ('business.manage_profile', 'Manage business profile and public identity.', 'sensitive'),
  ('business.manage_security', 'Manage sensitive tenant security settings.', 'high'),
  ('customers.manage', 'Create and update customer records.', 'sensitive'),
  ('customers.view', 'View customer records within effective scope.', 'sensitive'),
  ('locations.view', 'View locations within effective scope.', 'standard'),
  ('operations.check_in', 'Perform operational check-in.', 'standard'),
  ('operations.manage_incident', 'Create and manage permitted incidents.', 'high'),
  ('operations.record_feeding', 'Record feeding work.', 'standard'),
  ('operations.record_medication', 'Record medication work.', 'high'),
  ('payments.collect', 'Collect an approved payment.', 'sensitive'),
  ('payments.refund', 'Issue an approved refund.', 'high'),
  ('pets.manage_care', 'Manage permitted pet care information.', 'sensitive'),
  ('pets.view', 'View pet records within effective scope.', 'sensitive'),
  ('reports.export', 'Export approved tenant reports.', 'high'),
  ('reports.view_financial', 'View approved financial reports.', 'sensitive'),
  ('reports.view_operational', 'View operational reports.', 'standard'),
  ('staff.invite', 'Invite tenant staff.', 'high'),
  ('staff.manage_roles', 'Manage staff roles and location scope.', 'high'),
  ('website.edit', 'Edit approved public content.', 'standard'),
  ('website.publish', 'Publish approved public content.', 'sensitive');

insert into public.role_definitions
  (role_key, display_name, description, requires_mfa, sort_order) values
  ('owner', 'Owner', 'Tenant administration, security, billing, configuration, and authorized operations.', true, 10),
  ('manager', 'Manager', 'Broad assigned-location operations and staff oversight.', true, 20),
  ('front_desk', 'Front desk', 'Customers, pets, bookings, arrivals, departures, routine payments, and communications.', false, 30),
  ('care_staff', 'Care staff', 'Daily pet care, assigned tasks, observations, and permitted incidents.', false, 40),
  ('groomer', 'Groomer', 'Grooming schedule, assigned pets, service work, notes, and approved media.', false, 50),
  ('accountant', 'Accountant', 'Invoices, payments, reconciliation, and financial reporting.', true, 60),
  ('marketing_editor', 'Marketing editor', 'Website, approved public content, and permitted communications.', false, 70),
  ('read_only_auditor', 'Read-only auditor', 'Selected records, reports, and audit history without mutation.', true, 80);

insert into public.role_permissions (role_key, permission_key)
select 'owner', permission_key from public.permission_definitions;

insert into public.role_permissions (role_key, permission_key) values
  ('manager', 'audit.view'),
  ('manager', 'bookings.cancel'),
  ('manager', 'bookings.create'),
  ('manager', 'bookings.modify'),
  ('manager', 'bookings.view'),
  ('manager', 'business.manage_locations'),
  ('manager', 'business.manage_profile'),
  ('manager', 'customers.manage'),
  ('manager', 'customers.view'),
  ('manager', 'locations.view'),
  ('manager', 'operations.check_in'),
  ('manager', 'operations.manage_incident'),
  ('manager', 'operations.record_feeding'),
  ('manager', 'operations.record_medication'),
  ('manager', 'payments.collect'),
  ('manager', 'payments.refund'),
  ('manager', 'pets.manage_care'),
  ('manager', 'pets.view'),
  ('manager', 'reports.export'),
  ('manager', 'reports.view_financial'),
  ('manager', 'reports.view_operational'),
  ('manager', 'staff.invite'),
  ('manager', 'staff.manage_roles'),
  ('manager', 'website.edit'),
  ('manager', 'website.publish'),
  ('front_desk', 'bookings.cancel'),
  ('front_desk', 'bookings.create'),
  ('front_desk', 'bookings.modify'),
  ('front_desk', 'bookings.view'),
  ('front_desk', 'customers.manage'),
  ('front_desk', 'customers.view'),
  ('front_desk', 'locations.view'),
  ('front_desk', 'operations.check_in'),
  ('front_desk', 'payments.collect'),
  ('front_desk', 'pets.manage_care'),
  ('front_desk', 'pets.view'),
  ('care_staff', 'bookings.view'),
  ('care_staff', 'locations.view'),
  ('care_staff', 'operations.manage_incident'),
  ('care_staff', 'operations.record_feeding'),
  ('care_staff', 'operations.record_medication'),
  ('care_staff', 'pets.manage_care'),
  ('care_staff', 'pets.view'),
  ('groomer', 'bookings.view'),
  ('groomer', 'locations.view'),
  ('groomer', 'pets.view'),
  ('accountant', 'locations.view'),
  ('accountant', 'payments.collect'),
  ('accountant', 'payments.refund'),
  ('accountant', 'reports.export'),
  ('accountant', 'reports.view_financial'),
  ('marketing_editor', 'website.edit'),
  ('marketing_editor', 'website.publish'),
  ('read_only_auditor', 'audit.view'),
  ('read_only_auditor', 'bookings.view'),
  ('read_only_auditor', 'customers.view'),
  ('read_only_auditor', 'locations.view'),
  ('read_only_auditor', 'pets.view'),
  ('read_only_auditor', 'reports.view_financial'),
  ('read_only_auditor', 'reports.view_operational');

create or replace function app.is_active_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    join public.identity_profiles identity on identity.id = membership.identity_id
    join public.businesses business on business.id = membership.business_id
    where membership.business_id = target_business_id
      and membership.identity_id = auth.uid()
      and membership.state = 'active'
      and identity.status = 'active'
      and business.status in ('draft', 'active')
  );
$$;

create or replace function app.member_has_permission(
  target_business_id uuid,
  target_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    join public.identity_profiles identity on identity.id = membership.identity_id
    join public.businesses business on business.id = membership.business_id
    join public.membership_roles membership_role
      on membership_role.business_id = membership.business_id
      and membership_role.membership_id = membership.id
    join public.role_permissions role_permission
      on role_permission.role_key = membership_role.role_key
    where membership.business_id = target_business_id
      and membership.identity_id = auth.uid()
      and membership.state = 'active'
      and identity.status = 'active'
      and business.status in ('draft', 'active')
      and role_permission.permission_key = target_permission_key
  );
$$;

create or replace function app.member_can_access_location(
  target_business_id uuid,
  target_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    join public.identity_profiles identity on identity.id = membership.identity_id
    join public.businesses business on business.id = membership.business_id
    where membership.business_id = target_business_id
      and membership.identity_id = auth.uid()
      and membership.state = 'active'
      and identity.status = 'active'
      and business.status in ('draft', 'active')
      and (
        membership.location_scope_mode = 'all_current'
        or exists (
          select 1
          from public.membership_location_scopes location_scope
          where location_scope.business_id = target_business_id
            and location_scope.membership_id = membership.id
            and location_scope.location_id = target_location_id
        )
      )
  );
$$;

create or replace function app.write_audit_event(
  target_business_id uuid,
  target_actor_identity_id uuid,
  target_event_type text,
  target_entity_type text,
  target_entity_id uuid,
  target_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_event_id uuid;
begin
  insert into public.audit_events (
    business_id,
    actor_identity_id,
    event_type,
    entity_type,
    entity_id,
    details
  ) values (
    target_business_id,
    target_actor_identity_id,
    target_event_type,
    target_entity_type,
    target_entity_id,
    coalesce(target_details, '{}'::jsonb)
  ) returning id into audit_event_id;
  return audit_event_id;
end;
$$;

create or replace function app.create_business_with_owner(
  business_name text,
  business_slug text,
  first_location_name text,
  first_location_slug text,
  first_location_time_zone text
)
returns table (business_id uuid, location_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  created_business_id uuid;
  created_location_id uuid;
  created_membership_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.identity_profiles (id, display_name, status)
  select
    auth_user.id,
    coalesce(
      nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
      'New user'
    ),
    case when auth_user.email_confirmed_at is null then 'pending_verification' else 'active' end
  from auth.users auth_user
  where auth_user.id = actor_id
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.identity_profiles
    where id = actor_id and status = 'active'
  ) then
    raise exception 'active identity required' using errcode = '42501';
  end if;

  insert into public.businesses (name, public_slug, status, created_by)
  values (trim(business_name), lower(trim(business_slug)), 'draft', actor_id)
  returning id into created_business_id;

  insert into public.locations (business_id, name, public_slug, time_zone, status, created_by)
  values (
    created_business_id,
    trim(first_location_name),
    lower(trim(first_location_slug)),
    trim(first_location_time_zone),
    'draft',
    actor_id
  ) returning id into created_location_id;

  insert into public.business_memberships (
    business_id,
    identity_id,
    state,
    location_scope_mode,
    activated_at,
    created_by
  ) values (
    created_business_id,
    actor_id,
    'active',
    'all_current',
    now(),
    actor_id
  ) returning id into created_membership_id;

  insert into public.membership_roles (business_id, membership_id, role_key, assigned_by)
  values (created_business_id, created_membership_id, 'owner', actor_id);

  perform app.write_audit_event(
    created_business_id,
    actor_id,
    'business.created',
    'business',
    created_business_id,
    jsonb_build_object('first_location_id', created_location_id)
  );

  return query select created_business_id, created_location_id;
end;
$$;

create or replace function app.protect_last_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_owner_count integer;
  membership_is_owner boolean;
  membership_becomes_inactive boolean;
begin
  membership_becomes_inactive := tg_op = 'DELETE'
    or (tg_op = 'UPDATE' and old.state = 'active' and new.state <> 'active');
  if not membership_becomes_inactive then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select exists (
    select 1 from public.membership_roles role_assignment
    where role_assignment.business_id = old.business_id
      and role_assignment.membership_id = old.id
      and role_assignment.role_key = 'owner'
  ) into membership_is_owner;

  if not membership_is_owner then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select count(*) into active_owner_count
  from public.business_memberships membership
  join public.membership_roles role_assignment
    on role_assignment.business_id = membership.business_id
    and role_assignment.membership_id = membership.id
    and role_assignment.role_key = 'owner'
  where membership.business_id = old.business_id
    and membership.state = 'active';

  if active_owner_count <= 1 then
    raise exception 'the last active owner cannot be removed' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app.protect_last_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_owner_count integer;
  removing_owner boolean;
begin
  removing_owner := old.role_key = 'owner'
    and (
      tg_op = 'DELETE'
      or (
        tg_op = 'UPDATE'
        and (new.role_key <> 'owner' or new.membership_id <> old.membership_id)
      )
    );
  if not removing_owner then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select count(*) into active_owner_count
  from public.business_memberships membership
  join public.membership_roles role_assignment
    on role_assignment.business_id = membership.business_id
    and role_assignment.membership_id = membership.id
    and role_assignment.role_key = 'owner'
  where membership.business_id = old.business_id
    and membership.state = 'active';

  if active_owner_count <= 1 then
    raise exception 'the last active owner role cannot be removed' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit events are append-only' using errcode = '55000';
end;
$$;

create trigger business_memberships_protect_last_owner
before update of state or delete on public.business_memberships
for each row execute function app.protect_last_owner_membership();

create trigger membership_roles_protect_last_owner
before update or delete on public.membership_roles
for each row execute function app.protect_last_owner_role();

create trigger audit_events_reject_mutation
before update or delete on public.audit_events
for each row execute function app.reject_audit_mutation();

alter table public.identity_profiles enable row level security;
alter table public.identity_profiles force row level security;
alter table public.businesses enable row level security;
alter table public.businesses force row level security;
alter table public.locations enable row level security;
alter table public.locations force row level security;
alter table public.business_memberships enable row level security;
alter table public.business_memberships force row level security;
alter table public.permission_definitions enable row level security;
alter table public.permission_definitions force row level security;
alter table public.role_definitions enable row level security;
alter table public.role_definitions force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.membership_roles enable row level security;
alter table public.membership_roles force row level security;
alter table public.membership_location_scopes enable row level security;
alter table public.membership_location_scopes force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy identity_profiles_select_own
on public.identity_profiles for select to authenticated
using (id = auth.uid());

create policy identity_profiles_update_own
on public.identity_profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy businesses_select_member
on public.businesses for select to authenticated
using (app.is_active_business_member(id));

create policy businesses_update_manager
on public.businesses for update to authenticated
using (app.member_has_permission(id, 'business.manage_profile'))
with check (app.member_has_permission(id, 'business.manage_profile'));

create policy locations_select_scoped_member
on public.locations for select to authenticated
using (app.member_can_access_location(business_id, id));

create policy locations_insert_manager
on public.locations for insert to authenticated
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and created_by = auth.uid()
);

create policy locations_update_manager
on public.locations for update to authenticated
using (app.member_has_permission(business_id, 'business.manage_locations'))
with check (app.member_has_permission(business_id, 'business.manage_locations'));

create policy memberships_select_self_or_manager
on public.business_memberships for select to authenticated
using (
  identity_id = auth.uid()
  or app.member_has_permission(business_id, 'staff.manage_roles')
);

create policy permission_definitions_select_authenticated
on public.permission_definitions for select to authenticated
using (true);

create policy role_definitions_select_authenticated
on public.role_definitions for select to authenticated
using (true);

create policy role_permissions_select_authenticated
on public.role_permissions for select to authenticated
using (true);

create policy membership_roles_select_self_or_manager
on public.membership_roles for select to authenticated
using (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = membership_roles.business_id
      and membership.id = membership_roles.membership_id
      and membership.identity_id = auth.uid()
  )
  or app.member_has_permission(business_id, 'staff.manage_roles')
);

create policy membership_location_scopes_select_self_or_manager
on public.membership_location_scopes for select to authenticated
using (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = membership_location_scopes.business_id
      and membership.id = membership_location_scopes.membership_id
      and membership.identity_id = auth.uid()
  )
  or app.member_has_permission(business_id, 'staff.manage_roles')
);

create policy audit_events_select_authorized
on public.audit_events for select to authenticated
using (app.member_has_permission(business_id, 'audit.view'));

revoke all on public.identity_profiles from anon;
revoke all on public.businesses from anon;
revoke all on public.locations from anon;
revoke all on public.business_memberships from anon;
revoke all on public.permission_definitions from anon;
revoke all on public.role_definitions from anon;
revoke all on public.role_permissions from anon;
revoke all on public.membership_roles from anon;
revoke all on public.membership_location_scopes from anon;
revoke all on public.audit_events from anon;
revoke all on public.identity_profiles from authenticated;
grant select on public.identity_profiles to authenticated;
grant update (display_name, preferred_name, locale, time_zone) on public.identity_profiles to authenticated;
revoke all on public.businesses from authenticated;
grant select on public.businesses to authenticated;
grant update (name, public_slug, status) on public.businesses to authenticated;
revoke all on public.locations from authenticated;
grant select, insert on public.locations to authenticated;
grant update (name, public_slug, time_zone, status) on public.locations to authenticated;
grant select on public.business_memberships to authenticated;
grant select on public.permission_definitions to authenticated;
grant select on public.role_definitions to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.membership_roles to authenticated;
grant select on public.membership_location_scopes to authenticated;
grant select on public.audit_events to authenticated;

revoke all on function app.set_updated_at() from public;
revoke all on function app.prevent_business_id_change() from public;
revoke all on function app.handle_new_auth_user() from public;
revoke all on function app.write_audit_event(uuid, uuid, text, text, uuid, jsonb) from public;
revoke all on function app.protect_last_owner_membership() from public;
revoke all on function app.protect_last_owner_role() from public;
revoke all on function app.reject_audit_mutation() from public;
revoke all on function app.is_active_business_member(uuid) from public;
revoke all on function app.member_has_permission(uuid, text) from public;
revoke all on function app.member_can_access_location(uuid, uuid) from public;
revoke all on function app.create_business_with_owner(text, text, text, text, text) from public;

grant execute on function app.is_active_business_member(uuid) to authenticated;
grant execute on function app.member_has_permission(uuid, text) to authenticated;
grant execute on function app.member_can_access_location(uuid, uuid) to authenticated;
grant execute on function app.create_business_with_owner(text, text, text, text, text) to authenticated;
