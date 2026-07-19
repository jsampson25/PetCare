-- PetCare E14 impact-previewed tenant restrictions with safety-critical continuity.
alter table public.platform_tenant_controls
  add column block_new_bookings boolean not null default false,
  add column block_marketing boolean not null default false,
  add column tenant_read_only boolean not null default false,
  add column preserve_care_access boolean not null default true,
  add column review_at timestamptz;

create or replace function app.platform_tenant_impact_snapshot(target_business_id uuid) returns jsonb
language sql security definer stable set search_path = '' as $$
  select case when app.platform_has_permission('platform.businesses.read') then jsonb_build_object(
    'business_id', business.id,
    'active_pets_in_care', (select count(*) from public.pet_visits visit
      where visit.business_id = business.id and visit.status = 'in_care'),
    'future_bookings', (select count(*) from public.bookings booking
      where booking.business_id = business.id and booking.status not in ('cancelled', 'completed')
        and exists (select 1 from public.booking_items item where item.business_id = business.id
          and item.booking_id = booking.id and item.ends_at > now())),
    'open_care_tasks', (select count(*) from public.care_tasks task
      where task.business_id = business.id and task.status in ('scheduled', 'in_progress')),
    'unpaid_invoice_count', (select count(*) from public.invoices invoice
      where invoice.business_id = business.id and invoice.status in ('issued', 'partially_paid', 'overdue')),
    'published_website', exists (select 1 from public.tenant_websites website
      where website.business_id = business.id and website.status = 'published'),
    'active_staff_members', (select count(*) from public.business_memberships membership
      where membership.business_id = business.id and membership.state = 'active'),
    'captured_at', date_trunc('minute', now()),
    'fingerprint', md5(concat_ws(':', business.id,
      (select count(*) from public.pet_visits visit where visit.business_id = business.id and visit.status = 'in_care'),
      (select count(*) from public.bookings booking where booking.business_id = business.id
        and booking.status not in ('cancelled', 'completed') and exists
          (select 1 from public.booking_items item where item.business_id = business.id
            and item.booking_id = booking.id and item.ends_at > now())),
      (select count(*) from public.care_tasks task where task.business_id = business.id
        and task.status in ('scheduled', 'in_progress')),
      (select count(*) from public.invoices invoice where invoice.business_id = business.id
        and invoice.status in ('issued', 'partially_paid', 'overdue')),
      (select count(*) from public.business_memberships membership where membership.business_id = business.id
        and membership.state = 'active')))
  ) end
  from public.businesses business where business.id = target_business_id
$$;

create or replace function app.tenant_allows_new_commerce(target_business_id uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select coalesce((select control.lifecycle_status not in ('suspended', 'closing', 'closed')
    and not control.block_new_bookings
    from public.platform_tenant_controls control where control.business_id = target_business_id), false)
$$;

create or replace function app.enforce_tenant_new_commerce_policy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not app.tenant_allows_new_commerce(new.business_id) then
    raise exception 'new tenant commerce is temporarily restricted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bookings_tenant_new_commerce_policy
before insert on public.bookings
for each row execute function app.enforce_tenant_new_commerce_policy();

create or replace function app.apply_platform_tenant_control(
  target_business_id uuid,
  next_status_value text,
  restriction_code_value text,
  reason_value text,
  confirmation_value text,
  impact_fingerprint_value text,
  review_at_value timestamptz,
  request_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_control public.platform_tenant_controls%rowtype;
  tenant public.businesses%rowtype;
  impact jsonb;
  event_id uuid;
begin
  if not app.platform_has_permission('platform.businesses.manage') then
    raise exception 'platform tenant control unavailable' using errcode = '42501';
  end if;
  select event.id into event_id from public.platform_tenant_events event
  where event.idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;
  select * into tenant from public.businesses where id = target_business_id;
  select * into current_control from public.platform_tenant_controls
  where business_id = target_business_id for update;
  impact := app.platform_tenant_impact_snapshot(target_business_id);
  if tenant.id is null
    or next_status_value not in ('active', 'restricted', 'suspended')
    or char_length(trim(coalesce(reason_value, ''))) < 12
    or char_length(trim(coalesce(request_key, ''))) < 8
    or coalesce(impact->>'fingerprint', '') <> trim(coalesce(impact_fingerprint_value, ''))
    or (next_status_value <> 'active' and char_length(trim(coalesce(restriction_code_value, ''))) < 3)
    or (next_status_value = 'suspended' and lower(trim(coalesce(confirmation_value, ''))) <> tenant.public_slug)
    or (next_status_value <> 'active' and review_at_value <= now())
    or (current_control.lifecycle_status, next_status_value) not in (
      ('active', 'restricted'), ('active', 'suspended'),
      ('restricted', 'active'), ('restricted', 'suspended'),
      ('suspended', 'active'), ('suspended', 'restricted')
    ) then
    raise exception 'current impact preview and controlled tenant transition required' using errcode = 'P0001';
  end if;

  update public.platform_tenant_controls set
    lifecycle_status = next_status_value,
    restriction_code = case when next_status_value = 'active' then null else trim(restriction_code_value) end,
    restriction_reason = case when next_status_value = 'active' then null else trim(reason_value) end,
    block_new_bookings = next_status_value in ('restricted', 'suspended'),
    block_marketing = next_status_value in ('restricted', 'suspended'),
    tenant_read_only = next_status_value = 'suspended',
    preserve_care_access = true,
    review_at = case when next_status_value = 'active' then null else review_at_value end,
    changed_by = auth.uid(), changed_at = now()
  where business_id = target_business_id;
  update public.businesses set status = case when next_status_value = 'suspended' then 'suspended' else 'active' end
  where id = target_business_id;
  insert into public.platform_tenant_events (
    business_id, event_type, from_status, to_status, reason, actor_id, idempotency_key
  ) values (
    target_business_id, 'lifecycle_changed', current_control.lifecycle_status,
    next_status_value, trim(reason_value) || ' Impact: ' || impact::text,
    auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.list_platform_tenants() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
begin
  if not app.platform_has_permission('platform.businesses.read') then
    raise exception 'platform tenant directory unavailable' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'business_id', business.id, 'name', business.name, 'public_slug', business.public_slug,
    'business_status', business.status, 'lifecycle_status', control.lifecycle_status,
    'restriction_code', control.restriction_code, 'restriction_reason', control.restriction_reason,
    'block_new_bookings', control.block_new_bookings, 'block_marketing', control.block_marketing,
    'tenant_read_only', control.tenant_read_only, 'preserve_care_access', control.preserve_care_access,
    'review_at', control.review_at, 'changed_at', control.changed_at,
    'location_count', (select count(*) from public.locations location where location.business_id = business.id and location.status <> 'archived'),
    'active_member_count', (select count(*) from public.business_memberships membership where membership.business_id = business.id and membership.state = 'active'),
    'impact', app.platform_tenant_impact_snapshot(business.id), 'created_at', business.created_at
  ) order by business.created_at desc) from public.businesses business
    join public.platform_tenant_controls control on control.business_id = business.id), '[]'::jsonb);
end;
$$;

revoke execute on function app.transition_platform_tenant(uuid, text, text, text, text, text) from authenticated;
revoke all on function app.platform_tenant_impact_snapshot(uuid), app.tenant_allows_new_commerce(uuid),
  app.apply_platform_tenant_control(uuid, text, text, text, text, text, timestamptz, text) from public;
grant execute on function app.platform_tenant_impact_snapshot(uuid), app.tenant_allows_new_commerce(uuid),
  app.apply_platform_tenant_control(uuid, text, text, text, text, text, timestamptz, text) to authenticated;
