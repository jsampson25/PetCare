-- PetCare E14 case-linked, scoped, time-limited platform support access.
alter table public.platform_permission_definitions
  drop constraint platform_permission_definitions_permission_key_check;

alter table public.platform_permission_definitions
  add constraint platform_permission_definitions_permission_key_check
  check (
    permission_key in (
      'platform.businesses.read',
      'platform.businesses.manage',
      'platform.audit.read',
      'platform.subscriptions.read',
      'platform.subscriptions.manage',
      'platform.features.read',
      'platform.features.manage',
      'platform.support.read',
      'platform.support.manage',
      'platform.support.write'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.support.read', 'View safe support-case and session metadata.'),
  ('platform.support.manage', 'Open and revoke scoped tenant support sessions.'),
  ('platform.support.write', 'Request supported tenant-domain write commands during support.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.support.read'),
  ('platform_admin', 'platform.support.manage'),
  ('platform_admin', 'platform.support.write'),
  ('platform_support', 'platform.support.read'),
  ('platform_support', 'platform.support.manage'),
  ('platform_auditor', 'platform.support.read');

create table public.platform_support_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique check (case_key ~ '^[A-Z][A-Z0-9-]{5,39}$'),
  business_id uuid not null references public.businesses(id) on delete restrict,
  summary text not null check (char_length(trim(summary)) between 12 and 200),
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  opened_by uuid not null references public.identity_profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_support_case_id uuid not null references public.platform_support_cases(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  operator_id uuid not null references public.identity_profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  scopes text[] not null check (
    cardinality(scopes) between 1 and 5
    and scopes <@ array[
      'configuration', 'operations', 'communications', 'commerce', 'audit'
    ]::text[]
  ),
  write_enabled boolean not null default false,
  reason text not null check (char_length(trim(reason)) between 12 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.identity_profiles(id) on delete restrict,
  revocation_reason text,
  check (expires_at > started_at and expires_at <= started_at + interval '2 hours'),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index platform_support_sessions_active_idx
  on public.platform_support_sessions(operator_id, business_id, expires_at)
  where status = 'active';

create table public.platform_support_session_events (
  id uuid primary key default gen_random_uuid(),
  platform_support_session_id uuid not null references public.platform_support_sessions(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  event_type text not null check (event_type in ('session_opened', 'session_revoked')),
  scopes text[] not null,
  write_enabled boolean not null,
  reason text not null,
  actor_id uuid not null references public.identity_profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create trigger platform_support_session_events_immutable
before update or delete on public.platform_support_session_events
for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.open_platform_support_session(
  target_business_id uuid,
  case_key_value text,
  case_summary_value text,
  scopes_value text[],
  write_enabled_value boolean,
  duration_minutes integer,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  support_case public.platform_support_cases%rowtype;
  support_session_id uuid;
begin
  if not app.platform_has_permission('platform.support.manage')
     or (write_enabled_value and not app.platform_has_permission('platform.support.write')) then
    raise exception 'support session unavailable' using errcode = '42501';
  end if;

  select platform_support_session_id into support_session_id
  from public.platform_support_session_events
  where idempotency_key = trim(request_key);
  if support_session_id is not null then return support_session_id; end if;

  if not exists (select 1 from public.businesses where id = target_business_id)
     or trim(case_key_value) !~ '^[A-Z][A-Z0-9-]{5,39}$'
     or char_length(trim(coalesce(case_summary_value, ''))) not between 12 and 200
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500
     or duration_minutes not between 15 and 120
     or cardinality(scopes_value) not between 1 and 5
     or not scopes_value <@ array[
       'configuration', 'operations', 'communications', 'commerce', 'audit'
     ]::text[] then
    raise exception 'documented scoped support session required' using errcode = '22023';
  end if;

  insert into public.platform_support_cases (
    case_key, business_id, summary, opened_by
  ) values (
    trim(case_key_value), target_business_id, trim(case_summary_value), auth.uid()
  )
  on conflict (case_key) do update set summary = excluded.summary
  where platform_support_cases.business_id = excluded.business_id
    and platform_support_cases.status = 'open'
  returning * into support_case;

  if support_case.id is null then
    raise exception 'open case does not match tenant' using errcode = 'P0001';
  end if;

  insert into public.platform_support_sessions (
    platform_support_case_id, business_id, operator_id, scopes, write_enabled,
    reason, expires_at
  ) values (
    support_case.id, target_business_id, auth.uid(), scopes_value, write_enabled_value,
    trim(reason_value), now() + make_interval(mins => duration_minutes)
  ) returning id into support_session_id;

  insert into public.platform_support_session_events (
    platform_support_session_id, business_id, event_type, scopes, write_enabled,
    reason, actor_id, idempotency_key
  ) values (
    support_session_id, target_business_id, 'session_opened', scopes_value,
    write_enabled_value, trim(reason_value), auth.uid(), trim(request_key)
  );
  return support_session_id;
end;
$$;

create or replace function app.revoke_platform_support_session(
  support_session_id_value uuid,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  support_session public.platform_support_sessions%rowtype;
  event_id uuid;
begin
  if not app.platform_has_permission('platform.support.manage') then
    raise exception 'support session unavailable' using errcode = '42501';
  end if;

  select id into event_id from public.platform_support_session_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;

  select * into support_session from public.platform_support_sessions
  where id = support_session_id_value for update;
  if support_session.id is null or support_session.status <> 'active'
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'active support session and reason required' using errcode = '22023';
  end if;

  update public.platform_support_sessions set
    status = 'revoked', revoked_at = now(), revoked_by = auth.uid(),
    revocation_reason = trim(reason_value)
  where id = support_session.id;

  insert into public.platform_support_session_events (
    platform_support_session_id, business_id, event_type, scopes, write_enabled,
    reason, actor_id, idempotency_key
  ) values (
    support_session.id, support_session.business_id, 'session_revoked',
    support_session.scopes, support_session.write_enabled, trim(reason_value),
    auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.platform_support_session_allows(
  target_business_id uuid,
  required_scope text,
  require_write boolean default false
) returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_support_sessions support_session
    where support_session.business_id = target_business_id
      and support_session.operator_id = auth.uid()
      and support_session.status = 'active'
      and support_session.expires_at > now()
      and required_scope = any(support_session.scopes)
      and (not require_write or support_session.write_enabled)
  )
$$;

create or replace function app.list_platform_support_sessions() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.support.read') then
    raise exception 'support session directory unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'session_id', support_session.id,
      'business_id', business.id,
      'business_name', business.name,
      'public_slug', business.public_slug,
      'case_key', support_case.case_key,
      'case_summary', support_case.summary,
      'status', case
        when support_session.status = 'active' and support_session.expires_at <= now() then 'expired'
        else support_session.status
      end,
      'scopes', support_session.scopes,
      'write_enabled', support_session.write_enabled,
      'operator_id', support_session.operator_id,
      'started_at', support_session.started_at,
      'expires_at', support_session.expires_at
    ) order by support_session.started_at desc)
    from public.platform_support_sessions support_session
    join public.platform_support_cases support_case
      on support_case.id = support_session.platform_support_case_id
    join public.businesses business on business.id = support_session.business_id
  ), '[]'::jsonb);
end;
$$;

create or replace function app.list_tenant_support_access(target_business_id uuid) returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'business.manage_profile') then
    raise exception 'support access history unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'case_key', support_case.case_key,
      'status', case
        when support_session.status = 'active' and support_session.expires_at <= now() then 'expired'
        else support_session.status
      end,
      'scopes', support_session.scopes,
      'write_enabled', support_session.write_enabled,
      'started_at', support_session.started_at,
      'expires_at', support_session.expires_at,
      'revoked_at', support_session.revoked_at
    ) order by support_session.started_at desc)
    from public.platform_support_sessions support_session
    join public.platform_support_cases support_case
      on support_case.id = support_session.platform_support_case_id
    where support_session.business_id = target_business_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_support_cases',
    'platform_support_sessions',
    'platform_support_session_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_support_cases, public.platform_support_sessions,
  public.platform_support_session_events to authenticated;
create policy platform_support_cases_operator on public.platform_support_cases
for select to authenticated using (app.platform_has_permission('platform.support.read'));
create policy platform_support_sessions_operator on public.platform_support_sessions
for select to authenticated using (app.platform_has_permission('platform.support.read'));
create policy platform_support_events_operator on public.platform_support_session_events
for select to authenticated using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.open_platform_support_session(uuid, text, text, text[], boolean, integer, text, text),
  app.revoke_platform_support_session(uuid, text, text),
  app.platform_support_session_allows(uuid, text, boolean),
  app.list_platform_support_sessions(), app.list_tenant_support_access(uuid) from public;
grant execute on function app.open_platform_support_session(uuid, text, text, text[], boolean, integer, text, text),
  app.revoke_platform_support_session(uuid, text, text),
  app.platform_support_session_allows(uuid, text, boolean),
  app.list_platform_support_sessions(), app.list_tenant_support_access(uuid) to authenticated;
