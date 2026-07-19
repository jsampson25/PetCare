-- PetCare E14 release controls, entitlement-aware evaluation, and emergency kill switches.
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
      'platform.features.manage'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.features.read', 'View platform feature release controls and rollout impact.'),
  ('platform.features.manage', 'Manage audited feature rollout and emergency kill switches.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.features.read'),
  ('platform_admin', 'platform.features.manage'),
  ('platform_support', 'platform.features.read'),
  ('platform_auditor', 'platform.features.read');

create table public.platform_feature_flags (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique check (feature_key ~ '^[a-z][a-z0-9_.]*$'),
  display_name text not null,
  description text not null,
  entitlement_key text,
  release_state text not null default 'disabled'
    check (release_state in ('disabled', 'enabled', 'kill_switch')),
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  changed_by uuid not null references public.identity_profiles(id) on delete restrict,
  changed_at timestamptz not null default now()
);

create table public.platform_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  platform_feature_id uuid not null references public.platform_feature_flags(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  override_state text not null check (override_state in ('enabled', 'disabled')),
  reason text not null check (char_length(trim(reason)) between 12 and 500),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  changed_by uuid not null references public.identity_profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (platform_feature_id, business_id),
  check (expires_at is null or expires_at > starts_at)
);

create table public.platform_feature_events (
  id uuid primary key default gen_random_uuid(),
  platform_feature_id uuid not null references public.platform_feature_flags(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  event_type text not null check (event_type in ('feature_created', 'release_changed', 'override_changed')),
  before_value jsonb,
  after_value jsonb not null,
  reason text not null,
  actor_id uuid not null references public.identity_profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create trigger platform_feature_events_immutable
before update or delete on public.platform_feature_events
for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.tenant_has_entitlement(
  target_business_id uuid,
  entitlement_key_value text
) returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when entitlement_key_value is null then true
    else coalesce((
      select case jsonb_typeof(entitlement.value)
        when 'boolean' then (entitlement.value #>> '{}')::boolean
        when 'number' then (entitlement.value #>> '{}')::numeric > 0
        when 'string' then nullif(entitlement.value #>> '{}', '') is not null
        else entitlement.value is not null
      end
      from public.tenant_saas_subscriptions subscription
      join public.saas_plan_entitlements entitlement
        on entitlement.saas_plan_version_id = subscription.saas_plan_version_id
       and entitlement.entitlement_key = entitlement_key_value
      where subscription.business_id = target_business_id
        and subscription.status in ('trialing', 'active', 'cancel_scheduled')
    ), false)
  end
$$;

create or replace function app.evaluate_tenant_feature(
  target_business_id uuid,
  feature_key_value text
) returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  feature public.platform_feature_flags%rowtype;
  override_record public.platform_feature_overrides%rowtype;
  entitled boolean;
  rollout_bucket integer;
  released boolean;
  allowed boolean;
  source_value text;
begin
  if not app.is_active_business_member(target_business_id)
     and not app.platform_has_permission('platform.features.read') then
    raise exception 'feature evaluation unavailable' using errcode = '42501';
  end if;

  select * into feature
  from public.platform_feature_flags
  where feature_key = feature_key_value;

  if feature.id is null then
    return jsonb_build_object('feature_key', feature_key_value, 'enabled', false, 'source', 'undefined');
  end if;

  entitled := app.tenant_has_entitlement(target_business_id, feature.entitlement_key);
  rollout_bucket := mod(
    hashtextextended(target_business_id::text || ':' || feature.feature_key, 0)
      & 9223372036854775807,
    100
  )::integer;
  released := feature.release_state = 'enabled' and rollout_bucket < feature.rollout_percentage;
  source_value := 'rollout';

  select * into override_record
  from public.platform_feature_overrides
  where platform_feature_id = feature.id
    and business_id = target_business_id
    and starts_at <= now()
    and (expires_at is null or expires_at > now());

  if override_record.id is not null then
    released := override_record.override_state = 'enabled';
    source_value := 'tenant_override';
  end if;

  if feature.release_state = 'kill_switch' then
    released := false;
    source_value := 'kill_switch';
  end if;

  allowed := released and entitled;
  return jsonb_build_object(
    'feature_key', feature.feature_key,
    'enabled', allowed,
    'release_state', feature.release_state,
    'entitled', entitled,
    'source', case when released and not entitled then 'entitlement_denied' else source_value end,
    'rollout_bucket', rollout_bucket
  );
end;
$$;

create or replace function app.list_platform_feature_controls() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.features.read') then
    raise exception 'feature controls unavailable' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'feature_key', feature.feature_key,
        'display_name', feature.display_name,
        'description', feature.description,
        'entitlement_key', feature.entitlement_key,
        'release_state', feature.release_state,
        'rollout_percentage', feature.rollout_percentage,
        'active_override_count', (
          select count(*)
          from public.platform_feature_overrides override_record
          where override_record.platform_feature_id = feature.id
            and override_record.starts_at <= now()
            and (override_record.expires_at is null or override_record.expires_at > now())
        ),
        'changed_at', feature.changed_at
      ) order by feature.display_name
    )
    from public.platform_feature_flags feature
  ), '[]'::jsonb);
end;
$$;

create or replace function app.configure_platform_feature(
  feature_key_value text,
  display_name_value text,
  description_value text,
  entitlement_key_value text,
  release_state_value text,
  rollout_percentage_value integer,
  reason_value text,
  confirmation_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  feature public.platform_feature_flags%rowtype;
  prior_value jsonb;
  event_id uuid;
  event_type_value text;
begin
  if not app.platform_has_permission('platform.features.manage') then
    raise exception 'feature control unavailable' using errcode = '42501';
  end if;

  select id into event_id
  from public.platform_feature_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;

  if feature_key_value !~ '^[a-z][a-z0-9_.]*$'
     or release_state_value not in ('disabled', 'enabled', 'kill_switch')
     or rollout_percentage_value not between 0 and 100
     or char_length(trim(coalesce(display_name_value, ''))) < 3
     or char_length(trim(coalesce(description_value, ''))) < 12
     or char_length(trim(coalesce(reason_value, ''))) < 12
     or (release_state_value = 'kill_switch' and trim(confirmation_value) <> feature_key_value) then
    raise exception 'documented feature control change required' using errcode = '22023';
  end if;

  select * into feature
  from public.platform_feature_flags
  where feature_key = feature_key_value
  for update;
  prior_value := case when feature.id is null then null else to_jsonb(feature) end;
  event_type_value := case when feature.id is null then 'feature_created' else 'release_changed' end;

  insert into public.platform_feature_flags (
    feature_key, display_name, description, entitlement_key, release_state,
    rollout_percentage, changed_by
  ) values (
    feature_key_value, trim(display_name_value), trim(description_value),
    nullif(trim(entitlement_key_value), ''), release_state_value,
    rollout_percentage_value, auth.uid()
  )
  on conflict (feature_key) do update set
    display_name = excluded.display_name,
    description = excluded.description,
    entitlement_key = excluded.entitlement_key,
    release_state = excluded.release_state,
    rollout_percentage = excluded.rollout_percentage,
    changed_by = excluded.changed_by,
    changed_at = now()
  returning * into feature;

  insert into public.platform_feature_events (
    platform_feature_id, event_type, before_value, after_value, reason,
    actor_id, idempotency_key
  ) values (
    feature.id, event_type_value, prior_value, to_jsonb(feature), trim(reason_value),
    auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.set_platform_feature_override(
  target_business_id uuid,
  feature_key_value text,
  override_state_value text,
  reason_value text,
  expires_at_value timestamptz,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  feature public.platform_feature_flags%rowtype;
  override_record public.platform_feature_overrides%rowtype;
  prior_value jsonb;
  event_id uuid;
begin
  if not app.platform_has_permission('platform.features.manage') then
    raise exception 'feature override unavailable' using errcode = '42501';
  end if;

  select id into event_id from public.platform_feature_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;

  select * into feature from public.platform_feature_flags where feature_key = feature_key_value;
  select * into override_record from public.platform_feature_overrides
  where platform_feature_id = feature.id and business_id = target_business_id for update;
  prior_value := case when override_record.id is null then null else to_jsonb(override_record) end;

  if feature.id is null
     or not exists (select 1 from public.businesses where id = target_business_id)
     or override_state_value not in ('enabled', 'disabled')
     or char_length(trim(coalesce(reason_value, ''))) < 12
     or (expires_at_value is not null and expires_at_value <= now()) then
    raise exception 'documented feature override required' using errcode = '22023';
  end if;

  insert into public.platform_feature_overrides (
    platform_feature_id, business_id, override_state, reason, expires_at, changed_by
  ) values (
    feature.id, target_business_id, override_state_value, trim(reason_value),
    expires_at_value, auth.uid()
  )
  on conflict (platform_feature_id, business_id) do update set
    override_state = excluded.override_state,
    reason = excluded.reason,
    starts_at = now(),
    expires_at = excluded.expires_at,
    changed_by = excluded.changed_by,
    changed_at = now()
  returning * into override_record;

  insert into public.platform_feature_events (
    platform_feature_id, business_id, event_type, before_value, after_value,
    reason, actor_id, idempotency_key
  ) values (
    feature.id, target_business_id, 'override_changed', prior_value,
    to_jsonb(override_record), trim(reason_value), auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'platform_feature_flags',
    'platform_feature_overrides',
    'platform_feature_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_feature_flags, public.platform_feature_overrides,
  public.platform_feature_events to authenticated;

create policy platform_feature_flags_operator on public.platform_feature_flags
for select to authenticated using (app.platform_has_permission('platform.features.read'));
create policy platform_feature_overrides_operator on public.platform_feature_overrides
for select to authenticated using (app.platform_has_permission('platform.features.read'));
create policy platform_feature_events_operator on public.platform_feature_events
for select to authenticated using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.tenant_has_entitlement(uuid, text),
  app.evaluate_tenant_feature(uuid, text), app.list_platform_feature_controls(),
  app.configure_platform_feature(text, text, text, text, text, integer, text, text, text),
  app.set_platform_feature_override(uuid, text, text, text, timestamptz, text) from public;
grant execute on function app.evaluate_tenant_feature(uuid, text), app.list_platform_feature_controls(),
  app.configure_platform_feature(text, text, text, text, text, integer, text, text, text),
  app.set_platform_feature_override(uuid, text, text, text, timestamptz, text) to authenticated;
