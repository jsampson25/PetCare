-- PetCare E14 safe administrative job visibility and idempotent retry controls.
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
      'platform.jobs.read', 'platform.jobs.manage'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.jobs.read', 'View sanitized platform administrative job state and history.'),
  ('platform.jobs.manage', 'Retry only administrative jobs declared safely retryable.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.jobs.read'),
  ('platform_admin', 'platform.jobs.manage'),
  ('platform_support', 'platform.jobs.read'),
  ('platform_support', 'platform.jobs.manage'),
  ('platform_auditor', 'platform.jobs.read');

create table public.platform_administrative_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete restrict,
  job_type text not null check (job_type in (
    'tenant_provisioning', 'subscription_reconciliation', 'domain_verification',
    'notification_replay', 'report_export', 'privacy_export', 'projection_rebuild'
  )),
  object_reference text check (object_reference is null or char_length(object_reference) between 3 and 120),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  retryable boolean not null default false,
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  attempt_count integer not null default 1 check (attempt_count > 0),
  idempotency_key text not null unique,
  error_category text,
  safe_error_message text,
  next_action text not null default 'wait' check (next_action in ('wait', 'retry', 'investigate', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status in ('succeeded', 'cancelled')) = (completed_at is not null)),
  check ((status = 'failed') = (error_category is not null)),
  check (safe_error_message is null or char_length(safe_error_message) <= 300),
  check (next_action <> 'retry' or (retryable and status = 'failed'))
);

create table public.platform_administrative_job_attempts (
  id uuid primary key default gen_random_uuid(),
  platform_administrative_job_id uuid not null references public.platform_administrative_jobs(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  outcome text not null check (outcome in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'retry_requested')),
  error_category text,
  safe_error_message text,
  requested_by uuid references public.identity_profiles(id) on delete restrict,
  reason text,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique,
  unique (platform_administrative_job_id, attempt_number, outcome),
  check (safe_error_message is null or char_length(safe_error_message) <= 300)
);

create trigger platform_administrative_job_attempts_immutable
before update or delete on public.platform_administrative_job_attempts
for each row execute function app.prevent_commercial_snapshot_change();
create trigger platform_administrative_jobs_updated
before update on public.platform_administrative_jobs
for each row execute function app.set_updated_at();

create or replace function app.register_platform_administrative_job(
  target_business_id uuid,
  job_type_value text,
  object_reference_value text,
  status_value text,
  retryable_value boolean,
  progress_percentage_value integer,
  error_category_value text,
  safe_error_message_value text,
  idempotency_key_value text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id uuid;
  next_action_value text;
begin
  select id into job_id from public.platform_administrative_jobs
  where idempotency_key = trim(idempotency_key_value);
  if job_id is not null then return job_id; end if;

  if (target_business_id is not null and not exists (
       select 1 from public.businesses where id = target_business_id
     ))
     or job_type_value not in (
       'tenant_provisioning', 'subscription_reconciliation', 'domain_verification',
       'notification_replay', 'report_export', 'privacy_export', 'projection_rebuild'
     )
     or status_value not in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
     or progress_percentage_value not between 0 and 100
     or (status_value = 'failed' and nullif(trim(error_category_value), '') is null)
     or char_length(coalesce(safe_error_message_value, '')) > 300 then
    raise exception 'valid sanitized administrative job required' using errcode = '22023';
  end if;

  next_action_value := case
    when status_value = 'failed' and retryable_value then 'retry'
    when status_value = 'failed' then 'investigate'
    when status_value in ('succeeded', 'cancelled') then 'none'
    else 'wait'
  end;

  insert into public.platform_administrative_jobs (
    business_id, job_type, object_reference, status, retryable,
    progress_percentage, idempotency_key, error_category, safe_error_message,
    next_action, completed_at
  ) values (
    target_business_id, job_type_value, nullif(trim(object_reference_value), ''),
    status_value, retryable_value, progress_percentage_value,
    trim(idempotency_key_value), nullif(trim(error_category_value), ''),
    nullif(trim(safe_error_message_value), ''), next_action_value,
    case when status_value in ('succeeded', 'cancelled') then now() end
  ) returning id into job_id;

  insert into public.platform_administrative_job_attempts (
    platform_administrative_job_id, attempt_number, outcome, error_category,
    safe_error_message, idempotency_key
  ) values (
    job_id, 1, status_value, nullif(trim(error_category_value), ''),
    nullif(trim(safe_error_message_value), ''), trim(idempotency_key_value) || ':attempt:1'
  );
  return job_id;
end;
$$;

create or replace function app.retry_platform_administrative_job(
  target_job_id uuid,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.platform_administrative_jobs%rowtype;
  attempt_id uuid;
begin
  if not app.platform_has_permission('platform.jobs.manage') then
    raise exception 'administrative retry unavailable' using errcode = '42501';
  end if;

  select id into attempt_id from public.platform_administrative_job_attempts
  where idempotency_key = trim(request_key);
  if attempt_id is not null then return attempt_id; end if;

  select * into job from public.platform_administrative_jobs
  where id = target_job_id for update;
  if job.id is null or job.status <> 'failed' or not job.retryable
     or job.next_action <> 'retry'
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'job is not safely retryable' using errcode = 'P0001';
  end if;

  update public.platform_administrative_jobs set
    status = 'queued', progress_percentage = 0, attempt_count = attempt_count + 1,
    error_category = null, safe_error_message = null, next_action = 'wait', completed_at = null
  where id = job.id;

  insert into public.platform_administrative_job_attempts (
    platform_administrative_job_id, attempt_number, outcome, requested_by,
    reason, idempotency_key
  ) values (
    job.id, job.attempt_count + 1, 'retry_requested', auth.uid(),
    trim(reason_value), trim(request_key)
  ) returning id into attempt_id;
  return attempt_id;
end;
$$;

create or replace function app.list_platform_administrative_jobs() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.jobs.read') then
    raise exception 'administrative job directory unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'job_id', job.id,
      'business_id', job.business_id,
      'business_name', business.name,
      'job_type', job.job_type,
      'object_reference', job.object_reference,
      'status', job.status,
      'retryable', job.retryable,
      'progress_percentage', job.progress_percentage,
      'attempt_count', job.attempt_count,
      'error_category', job.error_category,
      'safe_error_message', job.safe_error_message,
      'next_action', job.next_action,
      'created_at', job.created_at,
      'updated_at', job.updated_at
    ) order by job.created_at desc)
    from public.platform_administrative_jobs job
    left join public.businesses business on business.id = job.business_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_administrative_jobs', 'platform_administrative_job_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_administrative_jobs,
  public.platform_administrative_job_attempts to authenticated;
create policy platform_administrative_jobs_operator on public.platform_administrative_jobs
for select to authenticated using (app.platform_has_permission('platform.jobs.read'));
create policy platform_administrative_job_attempts_operator on public.platform_administrative_job_attempts
for select to authenticated using (app.platform_has_permission('platform.jobs.read'));

revoke all on function app.register_platform_administrative_job(uuid, text, text, text, boolean, integer, text, text, text),
  app.retry_platform_administrative_job(uuid, text, text),
  app.list_platform_administrative_jobs() from public;
grant execute on function app.register_platform_administrative_job(uuid, text, text, text, boolean, integer, text, text, text)
  to service_role;
grant execute on function app.retry_platform_administrative_job(uuid, text, text),
  app.list_platform_administrative_jobs() to authenticated;
