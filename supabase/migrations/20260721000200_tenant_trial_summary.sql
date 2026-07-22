-- Allow a tenant member to read the commercial status of their own business.
-- This exposes a narrow summary rather than platform subscription administration.

create or replace function app.get_tenant_subscription_summary(target_business_id uuid)
returns table (
  plan_key text,
  plan_name text,
  subscription_status text,
  trial_ends_at timestamptz,
  trial_days_remaining integer,
  current_period_end timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_business_member(target_business_id) then
    raise exception 'business membership required' using errcode = '42501';
  end if;

  return query
  select
    plan.plan_key,
    plan.display_name,
    subscription.status,
    subscription.trial_ends_at,
    case
      when subscription.trial_ends_at is null then null
      else greatest(
        0,
        ceil(extract(epoch from (subscription.trial_ends_at - now())) / 86400)::integer
      )
    end,
    subscription.current_period_end
  from public.tenant_saas_subscriptions subscription
  join public.saas_plan_versions version on version.id = subscription.saas_plan_version_id
  join public.saas_plans plan on plan.id = version.saas_plan_id
  where subscription.business_id = target_business_id
  limit 1;
end;
$$;

revoke all on function app.get_tenant_subscription_summary(uuid) from public;
grant execute on function app.get_tenant_subscription_summary(uuid) to authenticated;
