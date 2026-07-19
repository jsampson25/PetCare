-- PetCare E14 resumable tenant provisioning visibility and supported recovery.
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
      'platform.health.read', 'platform.health.manage',
      'platform.provisioning.read', 'platform.provisioning.manage'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.provisioning.read', 'View tenant provisioning readiness and sanitized failures.'),
  ('platform.provisioning.manage', 'Request supported retries for retryable provisioning steps.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.provisioning.read'),
  ('platform_admin', 'platform.provisioning.manage'),
  ('platform_support', 'platform.provisioning.read'),
  ('platform_support', 'platform.provisioning.manage'),
  ('platform_auditor', 'platform.provisioning.read');

create table public.tenant_provisioning_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  run_key text not null unique,
  status text not null default 'running' check (status in ('running', 'failed', 'completed', 'cancelled')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  current_step_key text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status in ('completed', 'cancelled')) = (completed_at is not null))
);

create unique index tenant_provisioning_one_live_run_idx
  on public.tenant_provisioning_runs(business_id)
  where status in ('running', 'failed');

create table public.tenant_provisioning_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_provisioning_run_id uuid not null references public.tenant_provisioning_runs(id) on delete restrict,
  step_key text not null check (step_key in (
    'reserve_tenant', 'owner_membership', 'tenant_security', 'business_defaults',
    'trial_subscription', 'default_hostname', 'onboarding_readiness', 'isolation_validation'
  )),
  sequence_number integer not null check (sequence_number between 1 and 8),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  retryable boolean not null default true,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_category text,
  safe_error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_provisioning_run_id, step_key),
  unique (tenant_provisioning_run_id, sequence_number),
  check ((status = 'failed') = (error_category is not null)),
  check (safe_error_message is null or char_length(safe_error_message) <= 300),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.tenant_provisioning_events (
  id uuid primary key default gen_random_uuid(),
  tenant_provisioning_run_id uuid not null references public.tenant_provisioning_runs(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  step_key text,
  event_type text not null check (event_type in ('run_started', 'step_changed', 'retry_requested', 'run_completed')),
  from_status text,
  to_status text not null,
  reason text not null,
  actor_id uuid references public.identity_profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create trigger tenant_provisioning_runs_updated
before update on public.tenant_provisioning_runs
for each row execute function app.set_updated_at();
create trigger tenant_provisioning_steps_updated
before update on public.tenant_provisioning_steps
for each row execute function app.set_updated_at();
create trigger tenant_provisioning_events_immutable
before update or delete on public.tenant_provisioning_events
for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.register_tenant_provisioning_run(
  target_business_id uuid,
  run_key_value text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
begin
  select id into run_id from public.tenant_provisioning_runs
  where run_key = trim(run_key_value);
  if run_id is not null then return run_id; end if;
  if not exists (select 1 from public.businesses where id = target_business_id)
     or char_length(trim(coalesce(run_key_value, ''))) not between 8 and 120 then
    raise exception 'valid provisioning run required' using errcode = '22023';
  end if;

  insert into public.tenant_provisioning_runs (
    business_id, run_key, current_step_key
  ) values (
    target_business_id, trim(run_key_value), 'reserve_tenant'
  ) returning id into run_id;

  insert into public.tenant_provisioning_steps (
    tenant_provisioning_run_id, step_key, sequence_number, status
  ) values
    (run_id, 'reserve_tenant', 1, 'running'),
    (run_id, 'owner_membership', 2, 'pending'),
    (run_id, 'tenant_security', 3, 'pending'),
    (run_id, 'business_defaults', 4, 'pending'),
    (run_id, 'trial_subscription', 5, 'pending'),
    (run_id, 'default_hostname', 6, 'pending'),
    (run_id, 'onboarding_readiness', 7, 'pending'),
    (run_id, 'isolation_validation', 8, 'pending');

  insert into public.tenant_provisioning_events (
    tenant_provisioning_run_id, business_id, event_type, to_status,
    reason, idempotency_key
  ) values (
    run_id, target_business_id, 'run_started', 'running',
    'Tenant provisioning orchestration registered.', trim(run_key_value) || ':started'
  );
  return run_id;
end;
$$;

create or replace function app.record_tenant_provisioning_step(
  run_id_value uuid,
  step_key_value text,
  status_value text,
  error_category_value text,
  safe_error_message_value text,
  retryable_value boolean,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.tenant_provisioning_runs%rowtype;
  step public.tenant_provisioning_steps%rowtype;
  event_id uuid;
  next_step_key text;
begin
  select id into event_id from public.tenant_provisioning_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;
  select * into run from public.tenant_provisioning_runs where id = run_id_value for update;
  select * into step from public.tenant_provisioning_steps
  where tenant_provisioning_run_id = run_id_value and step_key = step_key_value for update;

  if run.id is null or run.status not in ('running', 'failed') or step.id is null
     or status_value not in ('running', 'completed', 'failed')
     or (status_value = 'failed' and nullif(trim(error_category_value), '') is null)
     or char_length(coalesce(safe_error_message_value, '')) > 300 then
    raise exception 'valid provisioning step outcome required' using errcode = '22023';
  end if;

  update public.tenant_provisioning_steps set
    status = status_value,
    retryable = retryable_value,
    attempt_count = case when status_value = 'running' then attempt_count + 1 else greatest(attempt_count, 1) end,
    error_category = case when status_value = 'failed' then trim(error_category_value) end,
    safe_error_message = case when status_value = 'failed' then nullif(trim(safe_error_message_value), '') end,
    started_at = case when status_value = 'running' then coalesce(started_at, now()) else started_at end,
    completed_at = case when status_value = 'completed' then now() end
  where id = step.id;

  if status_value = 'failed' then
    update public.tenant_provisioning_runs set status = 'failed', current_step_key = step.step_key
    where id = run.id;
  elsif status_value = 'completed' then
    select next_step.step_key into next_step_key
    from public.tenant_provisioning_steps next_step
    where next_step.tenant_provisioning_run_id = run.id
      and next_step.sequence_number = step.sequence_number + 1;
    if next_step_key is null then
      update public.tenant_provisioning_runs set
        status = 'completed', current_step_key = null, completed_at = now()
      where id = run.id;
      insert into public.tenant_provisioning_events (
        tenant_provisioning_run_id, business_id, event_type, from_status,
        to_status, reason, idempotency_key
      ) values (
        run.id, run.business_id, 'run_completed', run.status, 'completed',
        'All provisioning steps completed.', trim(request_key) || ':run-completed'
      );
    else
      update public.tenant_provisioning_steps set status = 'running', started_at = now(),
        attempt_count = attempt_count + 1
      where tenant_provisioning_run_id = run.id and step_key = next_step_key and status = 'pending';
      update public.tenant_provisioning_runs set status = 'running', current_step_key = next_step_key
      where id = run.id;
    end if;
  end if;

  insert into public.tenant_provisioning_events (
    tenant_provisioning_run_id, business_id, step_key, event_type, from_status,
    to_status, reason, idempotency_key
  ) values (
    run.id, run.business_id, step.step_key, 'step_changed', step.status,
    status_value, coalesce(nullif(trim(safe_error_message_value), ''), 'Provisioning step state recorded.'),
    trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.retry_tenant_provisioning_step(
  run_id_value uuid,
  reason_value text,
  request_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.tenant_provisioning_runs%rowtype;
  step public.tenant_provisioning_steps%rowtype;
  event_id uuid;
begin
  if not app.platform_has_permission('platform.provisioning.manage') then
    raise exception 'provisioning retry unavailable' using errcode = '42501';
  end if;
  select id into event_id from public.tenant_provisioning_events
  where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;
  select * into run from public.tenant_provisioning_runs where id = run_id_value for update;
  select * into step from public.tenant_provisioning_steps
  where tenant_provisioning_run_id = run.id and step_key = run.current_step_key for update;
  if run.id is null or run.status <> 'failed' or step.status <> 'failed' or not step.retryable
     or char_length(trim(coalesce(reason_value, ''))) not between 12 and 500 then
    raise exception 'provisioning step is not safely retryable' using errcode = 'P0001';
  end if;

  update public.tenant_provisioning_steps set
    status = 'running', attempt_count = attempt_count + 1,
    error_category = null, safe_error_message = null, started_at = now(), completed_at = null
  where id = step.id;
  update public.tenant_provisioning_runs set
    status = 'running', attempt_count = attempt_count + 1
  where id = run.id;

  insert into public.tenant_provisioning_events (
    tenant_provisioning_run_id, business_id, step_key, event_type, from_status,
    to_status, reason, actor_id, idempotency_key
  ) values (
    run.id, run.business_id, step.step_key, 'retry_requested', 'failed',
    'running', trim(reason_value), auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.list_tenant_provisioning_runs() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.provisioning.read') then
    raise exception 'provisioning directory unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'run_id', run.id,
      'business_id', run.business_id,
      'business_name', business.name,
      'public_slug', business.public_slug,
      'status', run.status,
      'attempt_count', run.attempt_count,
      'current_step_key', run.current_step_key,
      'started_at', run.started_at,
      'updated_at', run.updated_at,
      'steps', (
        select jsonb_agg(jsonb_build_object(
          'step_key', step.step_key,
          'sequence_number', step.sequence_number,
          'status', step.status,
          'retryable', step.retryable,
          'attempt_count', step.attempt_count,
          'error_category', step.error_category,
          'safe_error_message', step.safe_error_message
        ) order by step.sequence_number)
        from public.tenant_provisioning_steps step
        where step.tenant_provisioning_run_id = run.id
      )
    ) order by run.started_at desc)
    from public.tenant_provisioning_runs run
    join public.businesses business on business.id = run.business_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'tenant_provisioning_runs', 'tenant_provisioning_steps', 'tenant_provisioning_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.tenant_provisioning_runs, public.tenant_provisioning_steps,
  public.tenant_provisioning_events to authenticated;
create policy tenant_provisioning_runs_operator on public.tenant_provisioning_runs
for select to authenticated using (app.platform_has_permission('platform.provisioning.read'));
create policy tenant_provisioning_steps_operator on public.tenant_provisioning_steps
for select to authenticated using (app.platform_has_permission('platform.provisioning.read'));
create policy tenant_provisioning_events_operator on public.tenant_provisioning_events
for select to authenticated using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.register_tenant_provisioning_run(uuid, text),
  app.record_tenant_provisioning_step(uuid, text, text, text, text, boolean, text),
  app.retry_tenant_provisioning_step(uuid, text, text),
  app.list_tenant_provisioning_runs() from public;
grant execute on function app.register_tenant_provisioning_run(uuid, text),
  app.record_tenant_provisioning_step(uuid, text, text, text, text, boolean, text) to service_role;
grant execute on function app.retry_tenant_provisioning_step(uuid, text, text),
  app.list_tenant_provisioning_runs() to authenticated;
