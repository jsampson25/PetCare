-- Align public plans with marketing and allow a verified owner to start one trial
-- when creating a new business. Payment activation remains a separate flow.

do $$
declare
  starter_plan_id uuid;
  starter_version_id uuid;
  growth_plan_id uuid;
  growth_version_id uuid;
begin
  select id into starter_plan_id from public.saas_plans where plan_key = 'starter';

  update public.saas_plan_versions
  set status = 'superseded'
  where saas_plan_id = starter_plan_id and status = 'active';

  insert into public.saas_plan_versions (
    saas_plan_id, version_number, status, currency_code, billing_interval,
    unit_amount_minor, trial_days, effective_from
  )
  values (starter_plan_id, 2, 'active', 'USD', 'month', 7900, 14, now())
  returning id into starter_version_id;

  insert into public.saas_plan_entitlements (saas_plan_version_id, entitlement_key, value)
  select starter_version_id, key, value
  from jsonb_each(jsonb_build_object(
    'locations.max', 1,
    'staff.max', 10,
    'website.custom_domain', false,
    'website.advanced_layouts', false,
    'care.advanced_workflows', false,
    'reports.level', 'standard',
    'sms.monthly_included', 0
  ));

  insert into public.saas_plans (plan_key, display_name, status)
  values ('growth', 'Growth', 'active')
  on conflict (plan_key) do update set display_name = excluded.display_name, status = 'active'
  returning id into growth_plan_id;

  insert into public.saas_plan_versions (
    saas_plan_id, version_number, status, currency_code, billing_interval,
    unit_amount_minor, trial_days, effective_from
  )
  values (growth_plan_id, 1, 'active', 'USD', 'month', 14900, 14, now())
  returning id into growth_version_id;

  insert into public.saas_plan_entitlements (saas_plan_version_id, entitlement_key, value)
  select growth_version_id, key, value
  from jsonb_each(jsonb_build_object(
    'locations.max', 1,
    'staff.max', 50,
    'website.custom_domain', true,
    'website.advanced_layouts', true,
    'care.advanced_workflows', true,
    'reports.level', 'advanced',
    'sms.monthly_included', 500
  ));
end;
$$;

create or replace function app.start_owner_saas_trial(
  target_business_id uuid,
  requested_plan_key text
)
returns table (subscription_id uuid, trial_ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_version public.saas_plan_versions%rowtype;
  created_subscription_id uuid;
  trial_end_value timestamptz;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if requested_plan_key not in ('starter', 'growth') then
    raise exception 'self-service trial plan unavailable' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.business_memberships membership
    join public.membership_roles role_assignment
      on role_assignment.business_id = membership.business_id
     and role_assignment.membership_id = membership.id
    where membership.business_id = target_business_id
      and membership.identity_id = actor_id
      and membership.state = 'active'
      and role_assignment.role_key = 'owner'
  ) then
    raise exception 'active business owner required' using errcode = '42501';
  end if;

  select version.* into selected_version
  from public.saas_plans plan
  join public.saas_plan_versions version
    on version.saas_plan_id = plan.id and version.status = 'active'
  where plan.plan_key = requested_plan_key and plan.status = 'active';

  if selected_version.id is null or selected_version.trial_days <= 0 then
    raise exception 'active trial plan unavailable' using errcode = 'P0001';
  end if;

  select existing.id, existing.trial_ends_at
  into created_subscription_id, trial_end_value
  from public.tenant_saas_subscriptions existing
  where existing.business_id = target_business_id;

  if created_subscription_id is null then
    trial_end_value := now() + make_interval(days => selected_version.trial_days);

    insert into public.tenant_saas_subscriptions (
      business_id, saas_plan_version_id, status, provider,
      current_period_start, current_period_end, trial_ends_at, changed_by
    ) values (
      target_business_id, selected_version.id, 'trialing', 'manual',
      now(), trial_end_value, trial_end_value, actor_id
    ) returning id into created_subscription_id;

    insert into public.tenant_saas_subscription_events (
      business_id, tenant_subscription_id, event_type, to_status,
      reason, actor_id, idempotency_key
    ) values (
      target_business_id, created_subscription_id, 'assigned', 'trialing',
      'Self-service trial started during verified owner onboarding.', actor_id,
      'self-trial:' || target_business_id::text
    );
  end if;

  return query select created_subscription_id, trial_end_value;
end;
$$;

revoke all on function app.start_owner_saas_trial(uuid, text) from public;
grant execute on function app.start_owner_saas_trial(uuid, text) to authenticated;

