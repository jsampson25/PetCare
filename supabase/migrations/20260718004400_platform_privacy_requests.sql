-- PetCare E14 privacy request coordination without unsafe cross-domain cascades.
alter table public.platform_permission_definitions
  drop constraint platform_permission_definitions_permission_key_check;

alter table public.platform_permission_definitions
  add constraint platform_permission_definitions_permission_key_check
  check (
    permission_key in (
      'platform.businesses.read', 'platform.businesses.manage', 'platform.audit.read',
      'platform.subscriptions.read', 'platform.subscriptions.manage',
      'platform.features.read', 'platform.features.manage',
      'platform.support.read', 'platform.support.manage', 'platform.support.write',
      'platform.jobs.read', 'platform.jobs.manage',
      'platform.privacy.read', 'platform.privacy.manage'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.privacy.read', 'View minimized privacy-request coordination metadata.'),
  ('platform.privacy.manage', 'Coordinate verified privacy requests and domain actions.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.privacy.read'),
  ('platform_admin', 'platform.privacy.manage'),
  ('platform_auditor', 'platform.privacy.read');

create table public.platform_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  business_id uuid not null references public.businesses(id) on delete restrict,
  request_type text not null check (request_type in (
    'access', 'correction', 'portable_export', 'processing_restriction', 'deletion', 'objection_review'
  )),
  subject_reference text not null check (char_length(trim(subject_reference)) between 8 and 120),
  intake_channel text not null check (intake_channel in ('tenant_admin', 'customer_support', 'email', 'legal')),
  status text not null default 'received' check (status in (
    'received', 'identity_verified', 'in_progress', 'review', 'fulfilled', 'denied'
  )),
  legal_hold boolean not null default false,
  received_at timestamptz not null default now(),
  due_at timestamptz not null,
  verified_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.identity_profiles(id) on delete restrict,
  changed_by uuid not null references public.identity_profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (due_at > received_at),
  check ((status in ('fulfilled', 'denied')) = (completed_at is not null)),
  check ((status <> 'received') = (verified_at is not null) or status = 'denied')
);

create table public.platform_privacy_domain_actions (
  id uuid primary key default gen_random_uuid(),
  platform_privacy_request_id uuid not null references public.platform_privacy_requests(id) on delete restrict,
  domain_key text not null check (domain_key in (
    'identity', 'customer', 'pet', 'booking', 'operations', 'commerce', 'communications', 'documents'
  )),
  action_type text not null check (action_type in ('export', 'correct', 'restrict', 'delete', 'deidentify', 'retain')),
  status text not null check (status in ('pending', 'in_progress', 'completed', 'blocked', 'retained')),
  evidence_summary text check (evidence_summary is null or char_length(trim(evidence_summary)) between 12 and 500),
  retention_basis text,
  changed_by uuid not null references public.identity_profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (platform_privacy_request_id, domain_key),
  check ((status in ('completed', 'retained')) = (evidence_summary is not null)),
  check ((status = 'retained') = (retention_basis is not null))
);

create table public.platform_privacy_events (
  id uuid primary key default gen_random_uuid(),
  platform_privacy_request_id uuid not null references public.platform_privacy_requests(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  event_type text not null check (event_type in ('request_received', 'status_changed', 'domain_action_recorded')),
  before_status text,
  after_status text not null,
  domain_key text,
  reason text not null check (char_length(trim(reason)) between 12 and 500),
  actor_id uuid not null references public.identity_profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create trigger platform_privacy_events_immutable
before update or delete on public.platform_privacy_events
for each row execute function app.prevent_commercial_snapshot_change();
create trigger platform_privacy_requests_updated
before update on public.platform_privacy_requests
for each row execute function app.set_updated_at();
create trigger platform_privacy_domain_actions_updated
before update on public.platform_privacy_domain_actions
for each row execute function app.set_updated_at();

create or replace function app.create_platform_privacy_request(
  target_business_id uuid,
  request_type_value text,
  subject_reference_value text,
  intake_channel_value text,
  due_at_value timestamptz,
  legal_hold_value boolean,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  privacy_request_id uuid;
begin
  if not app.platform_has_permission('platform.privacy.manage') then
    raise exception 'privacy coordination unavailable' using errcode = '42501';
  end if;
  select platform_privacy_request_id into privacy_request_id
  from public.platform_privacy_events where idempotency_key = trim(request_key);
  if privacy_request_id is not null then return privacy_request_id; end if;

  if not exists (select 1 from public.businesses where id = target_business_id)
     or request_type_value not in (
       'access', 'correction', 'portable_export', 'processing_restriction', 'deletion', 'objection_review'
     )
     or intake_channel_value not in ('tenant_admin', 'customer_support', 'email', 'legal')
     or char_length(trim(coalesce(subject_reference_value, ''))) not between 8 and 120
     or due_at_value <= now()
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'valid minimized privacy request required' using errcode = '22023';
  end if;

  insert into public.platform_privacy_requests (
    business_id, request_type, subject_reference, intake_channel, legal_hold,
    due_at, created_by, changed_by
  ) values (
    target_business_id, request_type_value, trim(subject_reference_value),
    intake_channel_value, legal_hold_value, due_at_value, auth.uid(), auth.uid()
  ) returning id into privacy_request_id;

  insert into public.platform_privacy_events (
    platform_privacy_request_id, business_id, event_type, after_status,
    reason, actor_id, idempotency_key
  ) values (
    privacy_request_id, target_business_id, 'request_received', 'received',
    trim(reason_value), auth.uid(), trim(request_key)
  );
  return privacy_request_id;
end;
$$;

create or replace function app.transition_platform_privacy_request(
  privacy_request_id_value uuid,
  next_status_value text,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  privacy_request public.platform_privacy_requests%rowtype;
  event_id uuid;
begin
  if not app.platform_has_permission('platform.privacy.manage') then
    raise exception 'privacy coordination unavailable' using errcode = '42501';
  end if;
  select id into event_id from public.platform_privacy_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;

  select * into privacy_request from public.platform_privacy_requests
  where id = privacy_request_id_value for update;
  if privacy_request.id is null
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500
     or (privacy_request.status, next_status_value) not in (
       ('received', 'identity_verified'), ('received', 'denied'),
       ('identity_verified', 'in_progress'), ('in_progress', 'review'),
       ('review', 'in_progress'), ('review', 'fulfilled'), ('review', 'denied')
     )
     or (next_status_value = 'fulfilled' and privacy_request.legal_hold)
     or (next_status_value = 'fulfilled' and exists (
       select 1 from public.platform_privacy_domain_actions action
       where action.platform_privacy_request_id = privacy_request.id
         and action.status not in ('completed', 'retained')
     ))
     or (next_status_value = 'fulfilled' and not exists (
       select 1 from public.platform_privacy_domain_actions action
       where action.platform_privacy_request_id = privacy_request.id
     )) then
    raise exception 'controlled privacy transition required' using errcode = 'P0001';
  end if;

  update public.platform_privacy_requests set
    status = next_status_value,
    verified_at = case when next_status_value = 'identity_verified' then now() else verified_at end,
    completed_at = case when next_status_value in ('fulfilled', 'denied') then now() end,
    changed_by = auth.uid()
  where id = privacy_request.id;

  insert into public.platform_privacy_events (
    platform_privacy_request_id, business_id, event_type, before_status,
    after_status, reason, actor_id, idempotency_key
  ) values (
    privacy_request.id, privacy_request.business_id, 'status_changed',
    privacy_request.status, next_status_value, trim(reason_value), auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.record_platform_privacy_domain_action(
  privacy_request_id_value uuid,
  domain_key_value text,
  action_type_value text,
  status_value text,
  evidence_summary_value text,
  retention_basis_value text,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  privacy_request public.platform_privacy_requests%rowtype;
  action_id uuid;
begin
  if not app.platform_has_permission('platform.privacy.manage') then
    raise exception 'privacy domain coordination unavailable' using errcode = '42501';
  end if;
  select id into action_id from public.platform_privacy_events
  where idempotency_key = trim(request_key);
  if action_id is not null then return action_id; end if;
  select * into privacy_request from public.platform_privacy_requests
  where id = privacy_request_id_value;

  if privacy_request.id is null or privacy_request.status not in ('identity_verified', 'in_progress', 'review')
     or domain_key_value not in (
       'identity', 'customer', 'pet', 'booking', 'operations', 'commerce', 'communications', 'documents'
     )
     or action_type_value not in ('export', 'correct', 'restrict', 'delete', 'deidentify', 'retain')
     or status_value not in ('pending', 'in_progress', 'completed', 'blocked', 'retained')
     or (status_value in ('completed', 'retained') and char_length(trim(coalesce(evidence_summary_value, ''))) not between 12 and 500)
     or ((status_value = 'retained') <> (nullif(trim(coalesce(retention_basis_value, '')), '') is not null))
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'valid privacy domain action required' using errcode = '22023';
  end if;

  insert into public.platform_privacy_domain_actions (
    platform_privacy_request_id, domain_key, action_type, status,
    evidence_summary, retention_basis, changed_by
  ) values (
    privacy_request.id, domain_key_value, action_type_value, status_value,
    nullif(trim(evidence_summary_value), ''), nullif(trim(retention_basis_value), ''), auth.uid()
  )
  on conflict (platform_privacy_request_id, domain_key) do update set
    action_type = excluded.action_type,
    status = excluded.status,
    evidence_summary = excluded.evidence_summary,
    retention_basis = excluded.retention_basis,
    changed_by = excluded.changed_by
  returning id into action_id;

  insert into public.platform_privacy_events (
    platform_privacy_request_id, business_id, event_type, after_status,
    domain_key, reason, actor_id, idempotency_key
  ) values (
    privacy_request.id, privacy_request.business_id, 'domain_action_recorded',
    status_value, domain_key_value, trim(reason_value), auth.uid(), trim(request_key)
  ) returning id into action_id;
  return action_id;
end;
$$;

create or replace function app.list_platform_privacy_requests() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.privacy.read') then
    raise exception 'privacy request directory unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'request_id', privacy_request.id,
      'request_number', privacy_request.request_number,
      'business_id', privacy_request.business_id,
      'business_name', business.name,
      'request_type', privacy_request.request_type,
      'subject_reference', privacy_request.subject_reference,
      'status', privacy_request.status,
      'legal_hold', privacy_request.legal_hold,
      'received_at', privacy_request.received_at,
      'due_at', privacy_request.due_at,
      'domain_actions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'domain_key', action.domain_key,
          'action_type', action.action_type,
          'status', action.status,
          'evidence_summary', action.evidence_summary,
          'retention_basis', action.retention_basis
        ) order by action.domain_key)
        from public.platform_privacy_domain_actions action
        where action.platform_privacy_request_id = privacy_request.id
      ), '[]'::jsonb)
    ) order by privacy_request.due_at)
    from public.platform_privacy_requests privacy_request
    join public.businesses business on business.id = privacy_request.business_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_privacy_requests', 'platform_privacy_domain_actions', 'platform_privacy_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_privacy_requests, public.platform_privacy_domain_actions,
  public.platform_privacy_events to authenticated;
create policy platform_privacy_requests_operator on public.platform_privacy_requests
for select to authenticated using (app.platform_has_permission('platform.privacy.read'));
create policy platform_privacy_actions_operator on public.platform_privacy_domain_actions
for select to authenticated using (app.platform_has_permission('platform.privacy.read'));
create policy platform_privacy_events_operator on public.platform_privacy_events
for select to authenticated using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.create_platform_privacy_request(uuid, text, text, text, timestamptz, boolean, text, text),
  app.transition_platform_privacy_request(uuid, text, text, text),
  app.record_platform_privacy_domain_action(uuid, text, text, text, text, text, text, text),
  app.list_platform_privacy_requests() from public;
grant execute on function app.create_platform_privacy_request(uuid, text, text, text, timestamptz, boolean, text, text),
  app.transition_platform_privacy_request(uuid, text, text, text),
  app.record_platform_privacy_domain_action(uuid, text, text, text, text, text, text, text),
  app.list_platform_privacy_requests() to authenticated;
