-- PetCare E14 SaaS billing inbox and reconciliation, separate from tenant customer commerce.
alter table public.tenant_saas_subscriptions
  add column last_provider_event_at timestamptz,
  add column last_provider_event_id text;

create table public.platform_saas_billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  provider_created_at timestamptz not null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  provider_customer_reference text,
  provider_subscription_reference text not null,
  event_type text not null check (event_type in (
    'customer.subscription.created', 'customer.subscription.updated',
    'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'
  )),
  target_status text not null check (target_status in (
    'trialing', 'active', 'past_due', 'cancel_scheduled', 'cancelled'
  )),
  signature_verified boolean not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('received', 'applied', 'stale', 'quarantined', 'failed')),
  outcome_reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id),
  check ((status in ('applied', 'stale', 'quarantined', 'failed')) = (processed_at is not null))
);

create table public.platform_saas_billing_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  platform_saas_billing_event_id uuid not null references public.platform_saas_billing_events(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  event_type text not null check (event_type in ('received', 'quarantined', 'applied', 'stale', 'failed')),
  from_subscription_status text,
  to_subscription_status text,
  reason text not null,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create trigger platform_saas_billing_reconciliation_events_immutable
before update or delete on public.platform_saas_billing_reconciliation_events
for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.register_platform_saas_billing_event(
  provider_value text,
  provider_event_id_value text,
  provider_created_at_value timestamptz,
  target_business_id uuid,
  provider_customer_reference_value text,
  provider_subscription_reference_value text,
  event_type_value text,
  target_status_value text,
  signature_verified_value boolean,
  payload_sha256_value text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing_event_id uuid;
  initial_status text;
begin
  select id into billing_event_id from public.platform_saas_billing_events
  where provider = provider_value and provider_event_id = trim(provider_event_id_value);
  if billing_event_id is not null then return billing_event_id; end if;

  if provider_value <> 'stripe'
     or not exists (select 1 from public.businesses where id = target_business_id)
     or char_length(trim(coalesce(provider_event_id_value, ''))) not between 8 and 200
     or char_length(trim(coalesce(provider_subscription_reference_value, ''))) not between 8 and 200
     or event_type_value not in (
       'customer.subscription.created', 'customer.subscription.updated',
       'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'
     )
     or target_status_value not in ('trialing', 'active', 'past_due', 'cancel_scheduled', 'cancelled')
     or payload_sha256_value !~ '^[a-f0-9]{64}$' then
    raise exception 'valid minimized SaaS billing event required' using errcode = '22023';
  end if;

  initial_status := case when signature_verified_value then 'received' else 'quarantined' end;
  insert into public.platform_saas_billing_events (
    provider, provider_event_id, provider_created_at, business_id,
    provider_customer_reference, provider_subscription_reference,
    event_type, target_status, signature_verified, payload_sha256,
    status, outcome_reason, processed_at
  ) values (
    provider_value, trim(provider_event_id_value), provider_created_at_value,
    target_business_id, nullif(trim(provider_customer_reference_value), ''),
    trim(provider_subscription_reference_value), event_type_value, target_status_value,
    signature_verified_value, payload_sha256_value, initial_status,
    case when not signature_verified_value then 'Signature verification failed.' end,
    case when not signature_verified_value then now() end
  ) on conflict (provider, provider_event_id) do nothing
  returning id into billing_event_id;

  if billing_event_id is null then
    select id into billing_event_id from public.platform_saas_billing_events
    where provider = provider_value and provider_event_id = trim(provider_event_id_value);
    return billing_event_id;
  end if;

  insert into public.platform_saas_billing_reconciliation_events (
    platform_saas_billing_event_id, business_id, event_type, reason, idempotency_key
  ) values (
    billing_event_id, target_business_id,
    case when signature_verified_value then 'received' else 'quarantined' end,
    case when signature_verified_value then 'Verified provider event received.' else 'Unverified provider event quarantined.' end,
    provider_value || ':' || trim(provider_event_id_value) || ':received'
  );
  return billing_event_id;
end;
$$;

create or replace function app.process_platform_saas_billing_event(
  billing_event_id_value uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing_event public.platform_saas_billing_events%rowtype;
  subscription public.tenant_saas_subscriptions%rowtype;
  reconciliation_event_id uuid;
begin
  select * into billing_event from public.platform_saas_billing_events
  where id = billing_event_id_value for update;
  if billing_event.id is null or not billing_event.signature_verified then
    raise exception 'processable verified SaaS billing event unavailable' using errcode = 'P0002';
  end if;
  if billing_event.status <> 'received' then
    select id into reconciliation_event_id
    from public.platform_saas_billing_reconciliation_events
    where platform_saas_billing_event_id = billing_event.id
      and event_type = billing_event.status
    order by occurred_at desc
    limit 1;
    if reconciliation_event_id is not null then return reconciliation_event_id; end if;
    raise exception 'processed SaaS billing event lacks reconciliation history' using errcode = 'P0002';
  end if;
  select * into subscription from public.tenant_saas_subscriptions
  where business_id = billing_event.business_id for update;

  if subscription.id is null then
    update public.platform_saas_billing_events set
      status = 'failed', outcome_reason = 'Tenant subscription projection unavailable.', processed_at = now()
    where id = billing_event.id;
    insert into public.platform_saas_billing_reconciliation_events (
      platform_saas_billing_event_id, business_id, event_type, reason, idempotency_key
    ) values (
      billing_event.id, billing_event.business_id, 'failed',
      'Tenant subscription projection unavailable.',
      billing_event.provider || ':' || billing_event.provider_event_id || ':failed'
    ) returning id into reconciliation_event_id;
    return reconciliation_event_id;
  end if;

  if subscription.last_provider_event_at is not null
     and billing_event.provider_created_at <= subscription.last_provider_event_at then
    update public.platform_saas_billing_events set
      status = 'stale', outcome_reason = 'Older than the latest applied provider event.', processed_at = now()
    where id = billing_event.id;
    insert into public.platform_saas_billing_reconciliation_events (
      platform_saas_billing_event_id, business_id, event_type,
      from_subscription_status, to_subscription_status, reason, idempotency_key
    ) values (
      billing_event.id, billing_event.business_id, 'stale', subscription.status,
      subscription.status, 'Out-of-order event retained without reverting subscription.',
      billing_event.provider || ':' || billing_event.provider_event_id || ':stale'
    ) returning id into reconciliation_event_id;
    return reconciliation_event_id;
  end if;

  update public.tenant_saas_subscriptions set
    status = billing_event.target_status,
    provider = billing_event.provider,
    provider_customer_reference = coalesce(
      billing_event.provider_customer_reference, provider_customer_reference
    ),
    provider_subscription_reference = billing_event.provider_subscription_reference,
    cancel_at_period_end = billing_event.target_status = 'cancel_scheduled',
    last_provider_event_at = billing_event.provider_created_at,
    last_provider_event_id = billing_event.provider_event_id,
    changed_by = subscription.changed_by
  where id = subscription.id;
  update public.platform_saas_billing_events set
    status = 'applied', outcome_reason = 'Subscription projection converged.', processed_at = now()
  where id = billing_event.id;
  insert into public.platform_saas_billing_reconciliation_events (
    platform_saas_billing_event_id, business_id, event_type,
    from_subscription_status, to_subscription_status, reason, idempotency_key
  ) values (
    billing_event.id, billing_event.business_id, 'applied', subscription.status,
    billing_event.target_status, 'Verified provider event applied in order.',
    billing_event.provider || ':' || billing_event.provider_event_id || ':applied'
  ) returning id into reconciliation_event_id;
  return reconciliation_event_id;
end;
$$;

create or replace function app.list_platform_saas_billing_reconciliation() returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not app.platform_has_permission('platform.subscriptions.read') then
    raise exception 'SaaS billing reconciliation unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'event_id', billing_event.id,
      'provider_event_id', billing_event.provider_event_id,
      'provider_created_at', billing_event.provider_created_at,
      'business_id', billing_event.business_id,
      'business_name', business.name,
      'provider_subscription_reference', billing_event.provider_subscription_reference,
      'event_type', billing_event.event_type,
      'target_status', billing_event.target_status,
      'signature_verified', billing_event.signature_verified,
      'status', billing_event.status,
      'outcome_reason', billing_event.outcome_reason,
      'received_at', billing_event.received_at,
      'processed_at', billing_event.processed_at
    ) order by billing_event.received_at desc)
    from public.platform_saas_billing_events billing_event
    join public.businesses business on business.id = billing_event.business_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_saas_billing_events', 'platform_saas_billing_reconciliation_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_saas_billing_events,
  public.platform_saas_billing_reconciliation_events to authenticated;
create policy platform_saas_billing_events_operator on public.platform_saas_billing_events
for select to authenticated using (app.platform_has_permission('platform.subscriptions.read'));
create policy platform_saas_reconciliation_events_operator on public.platform_saas_billing_reconciliation_events
for select to authenticated using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.register_platform_saas_billing_event(text, text, timestamptz, uuid, text, text, text, text, boolean, text),
  app.process_platform_saas_billing_event(uuid),
  app.list_platform_saas_billing_reconciliation() from public;
grant execute on function app.register_platform_saas_billing_event(text, text, timestamptz, uuid, text, text, text, text, boolean, text),
  app.process_platform_saas_billing_event(uuid) to service_role;
grant execute on function app.list_platform_saas_billing_reconciliation() to authenticated;
