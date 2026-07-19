-- PetCare E14 platform health, founder issue correlation, and unified administrative audit search.
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
      'platform.privacy.read', 'platform.privacy.manage',
      'platform.health.read', 'platform.health.manage'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.health.read', 'View cross-tenant platform health aggregates and correlated issues.'),
  ('platform.health.manage', 'Record and resolve sanitized platform operational issues.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.health.read'),
  ('platform_admin', 'platform.health.manage'),
  ('platform_support', 'platform.health.read'),
  ('platform_support', 'platform.health.manage'),
  ('platform_auditor', 'platform.health.read');

create table public.platform_operational_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number bigint generated always as identity unique,
  business_id uuid references public.businesses(id) on delete restrict,
  correlation_key text not null check (correlation_key ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$'),
  source_type text not null check (source_type in (
    'tenant', 'subscription', 'feature', 'support', 'job', 'privacy', 'provider', 'deployment'
  )),
  source_reference text,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'monitoring', 'resolved')),
  summary text not null check (char_length(trim(summary)) between 12 and 240),
  impact_summary text not null check (char_length(trim(impact_summary)) between 12 and 500),
  created_by uuid not null references public.identity_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (correlation_key, status),
  check ((status = 'resolved') = (resolved_at is not null))
);

create table public.platform_operational_issue_events (
  id uuid primary key default gen_random_uuid(),
  platform_operational_issue_id uuid not null references public.platform_operational_issues(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  event_type text not null check (event_type in ('issue_opened', 'status_changed')),
  from_status text,
  to_status text not null,
  reason text not null check (char_length(trim(reason)) between 12 and 500),
  actor_id uuid not null references public.identity_profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create trigger platform_operational_issues_updated
before update on public.platform_operational_issues
for each row execute function app.set_updated_at();
create trigger platform_operational_issue_events_immutable
before update or delete on public.platform_operational_issue_events
for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.create_platform_operational_issue(
  target_business_id uuid,
  correlation_key_value text,
  source_type_value text,
  source_reference_value text,
  severity_value text,
  summary_value text,
  impact_summary_value text,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  issue_id uuid;
begin
  if not app.platform_has_permission('platform.health.manage') then
    raise exception 'platform issue management unavailable' using errcode = '42501';
  end if;
  select platform_operational_issue_id into issue_id
  from public.platform_operational_issue_events where idempotency_key = trim(request_key);
  if issue_id is not null then return issue_id; end if;

  if (target_business_id is not null and not exists (
       select 1 from public.businesses where id = target_business_id
     ))
     or trim(correlation_key_value) !~ '^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$'
     or source_type_value not in (
       'tenant', 'subscription', 'feature', 'support', 'job', 'privacy', 'provider', 'deployment'
     )
     or severity_value not in ('info', 'warning', 'critical')
     or char_length(trim(coalesce(summary_value, ''))) not between 12 and 240
     or char_length(trim(coalesce(impact_summary_value, ''))) not between 12 and 500
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'valid sanitized platform issue required' using errcode = '22023';
  end if;

  insert into public.platform_operational_issues (
    business_id, correlation_key, source_type, source_reference, severity,
    summary, impact_summary, created_by
  ) values (
    target_business_id, trim(correlation_key_value), source_type_value,
    nullif(trim(source_reference_value), ''), severity_value, trim(summary_value),
    trim(impact_summary_value), auth.uid()
  ) returning id into issue_id;

  insert into public.platform_operational_issue_events (
    platform_operational_issue_id, business_id, event_type, to_status,
    reason, actor_id, idempotency_key
  ) values (
    issue_id, target_business_id, 'issue_opened', 'open', trim(reason_value),
    auth.uid(), trim(request_key)
  );
  return issue_id;
end;
$$;

create or replace function app.transition_platform_operational_issue(
  issue_id_value uuid,
  next_status_value text,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  issue public.platform_operational_issues%rowtype;
  event_id uuid;
begin
  if not app.platform_has_permission('platform.health.manage') then
    raise exception 'platform issue management unavailable' using errcode = '42501';
  end if;
  select id into event_id from public.platform_operational_issue_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;
  select * into issue from public.platform_operational_issues where id = issue_id_value for update;

  if issue.id is null
     or (issue.status, next_status_value) not in (
       ('open', 'monitoring'), ('open', 'resolved'),
       ('monitoring', 'open'), ('monitoring', 'resolved')
     )
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'controlled platform issue transition required' using errcode = 'P0001';
  end if;

  update public.platform_operational_issues set
    status = next_status_value,
    resolved_at = case when next_status_value = 'resolved' then now() end
  where id = issue.id;
  insert into public.platform_operational_issue_events (
    platform_operational_issue_id, business_id, event_type, from_status,
    to_status, reason, actor_id, idempotency_key
  ) values (
    issue.id, issue.business_id, 'status_changed', issue.status,
    next_status_value, trim(reason_value), auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.get_platform_health_summary() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.health.read') then
    raise exception 'platform health unavailable' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'tenants', jsonb_build_object(
      'total', (select count(*) from public.platform_tenant_controls),
      'active', (select count(*) from public.platform_tenant_controls where lifecycle_status = 'active'),
      'restricted', (select count(*) from public.platform_tenant_controls where lifecycle_status = 'restricted'),
      'suspended', (select count(*) from public.platform_tenant_controls where lifecycle_status = 'suspended')
    ),
    'subscriptions_past_due', (
      select count(*) from public.tenant_saas_subscriptions where status = 'past_due'
    ),
    'active_support_sessions', (
      select count(*) from public.platform_support_sessions
      where status = 'active' and expires_at > now()
    ),
    'failed_retryable_jobs', (
      select count(*) from public.platform_administrative_jobs
      where status = 'failed' and retryable
    ),
    'overdue_privacy_requests', (
      select count(*) from public.platform_privacy_requests
      where status not in ('fulfilled', 'denied') and due_at < now()
    ),
    'open_critical_issues', (
      select count(*) from public.platform_operational_issues
      where status <> 'resolved' and severity = 'critical'
    )
  );
end;
$$;

create or replace function app.list_platform_operational_issues() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.health.read') then
    raise exception 'platform issues unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'issue_id', issue.id,
      'issue_number', issue.issue_number,
      'business_id', issue.business_id,
      'business_name', business.name,
      'correlation_key', issue.correlation_key,
      'source_type', issue.source_type,
      'source_reference', issue.source_reference,
      'severity', issue.severity,
      'status', issue.status,
      'summary', issue.summary,
      'impact_summary', issue.impact_summary,
      'created_at', issue.created_at,
      'updated_at', issue.updated_at
    ) order by case issue.severity when 'critical' then 1 when 'warning' then 2 else 3 end, issue.created_at desc)
    from public.platform_operational_issues issue
    left join public.businesses business on business.id = issue.business_id
  ), '[]'::jsonb);
end;
$$;

create or replace function app.search_platform_audit_events(
  target_business_id uuid default null,
  target_actor_id uuid default null,
  event_query text default null,
  case_key_query text default null,
  occurred_from timestamptz default null,
  occurred_to timestamptz default null,
  result_limit integer default 100
) returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.audit.read') then
    raise exception 'platform audit unavailable' using errcode = '42501';
  end if;
  if result_limit not between 1 and 250
     or (occurred_from is not null and occurred_to is not null and occurred_to <= occurred_from) then
    raise exception 'bounded audit search required' using errcode = '22023';
  end if;

  return coalesce((
    with unified as (
      select event.id, event.business_id, event.actor_id, event.event_type,
        'high'::text as risk, event.reason as summary, null::text as case_key,
        event.occurred_at
      from public.platform_tenant_events event
      union all
      select event.id, event.business_id, event.actor_id,
        'subscription.' || event.event_type,
        'high', event.reason, null, event.occurred_at
      from public.tenant_saas_subscription_events event
      union all
      select event.id, event.business_id, event.actor_id,
        'feature.' || event.event_type,
        case when event.after_value->>'release_state' = 'kill_switch' then 'critical' else 'high' end,
        event.reason, null, event.occurred_at
      from public.platform_feature_events event
      union all
      select event.id, event.business_id, event.actor_id,
        'support.' || event.event_type,
        case when event.write_enabled then 'high' else 'moderate' end,
        event.reason, support_case.case_key, event.occurred_at
      from public.platform_support_session_events event
      join public.platform_support_sessions support_session
        on support_session.id = event.platform_support_session_id
      join public.platform_support_cases support_case
        on support_case.id = support_session.platform_support_case_id
      union all
      select attempt.id, job.business_id, attempt.requested_by,
        'job.' || attempt.outcome, 'moderate',
        coalesce(attempt.reason, attempt.safe_error_message, job.job_type), null,
        attempt.occurred_at
      from public.platform_administrative_job_attempts attempt
      join public.platform_administrative_jobs job
        on job.id = attempt.platform_administrative_job_id
      union all
      select event.id, event.business_id, event.actor_id,
        'privacy.' || event.event_type, 'high', event.reason, null, event.occurred_at
      from public.platform_privacy_events event
      union all
      select event.id, event.business_id, event.actor_id,
        'health.' || event.event_type,
        case when issue.severity = 'critical' then 'critical' else 'moderate' end,
        event.reason, issue.correlation_key, event.occurred_at
      from public.platform_operational_issue_events event
      join public.platform_operational_issues issue
        on issue.id = event.platform_operational_issue_id
    )
    select jsonb_agg(jsonb_build_object(
      'event_id', unified.id,
      'business_id', unified.business_id,
      'business_name', business.name,
      'actor_id', unified.actor_id,
      'event_type', unified.event_type,
      'risk', unified.risk,
      'summary', unified.summary,
      'case_key', unified.case_key,
      'occurred_at', unified.occurred_at
    ) order by unified.occurred_at desc)
    from (
      select * from unified
      where (target_business_id is null or business_id = target_business_id)
        and (target_actor_id is null or actor_id = target_actor_id)
        and (nullif(trim(event_query), '') is null or event_type ilike '%' || trim(event_query) || '%')
        and (nullif(trim(case_key_query), '') is null or case_key ilike '%' || trim(case_key_query) || '%')
        and (occurred_from is null or occurred_at >= occurred_from)
        and (occurred_to is null or occurred_at < occurred_to)
      order by occurred_at desc
      limit result_limit
    ) unified
    left join public.businesses business on business.id = unified.business_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_operational_issues', 'platform_operational_issue_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_operational_issues,
  public.platform_operational_issue_events to authenticated;
create policy platform_operational_issues_operator on public.platform_operational_issues
for select to authenticated using (app.platform_has_permission('platform.health.read'));
create policy platform_operational_issue_events_operator on public.platform_operational_issue_events
for select to authenticated using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.create_platform_operational_issue(uuid, text, text, text, text, text, text, text, text),
  app.transition_platform_operational_issue(uuid, text, text, text),
  app.get_platform_health_summary(), app.list_platform_operational_issues(),
  app.search_platform_audit_events(uuid, uuid, text, text, timestamptz, timestamptz, integer) from public;
grant execute on function app.create_platform_operational_issue(uuid, text, text, text, text, text, text, text, text),
  app.transition_platform_operational_issue(uuid, text, text, text),
  app.get_platform_health_summary(), app.list_platform_operational_issues(),
  app.search_platform_audit_events(uuid, uuid, text, text, timestamptz, timestamptz, integer) to authenticated;
