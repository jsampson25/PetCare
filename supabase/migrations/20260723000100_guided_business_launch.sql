-- Guided onboarding launch joins the existing service, pricing, and website
-- publication engines in one transaction.

create or replace function app.launch_tenant_business(target_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_record public.businesses%rowtype;
  location_id_value uuid;
  price_version_id_value uuid;
  policy_version_id_value uuid;
  service_record record;
  website_record public.tenant_websites%rowtype;
  website_readiness jsonb;
begin
  if not (
    app.member_has_permission(target_business_id, 'business.manage_profile')
    and app.member_has_permission(target_business_id, 'services.manage')
    and app.member_has_permission(target_business_id, 'pricing.manage')
    and app.member_has_permission(target_business_id, 'website.publish')
  ) then
    raise exception 'business launch unavailable' using errcode = '42501';
  end if;

  select * into business_record
  from public.businesses
  where id = target_business_id
  for update;

  if business_record.id is null then
    raise exception 'business unavailable' using errcode = 'P0002';
  end if;

  if business_record.status = 'active' then
    return jsonb_build_object('status', 'active', 'public_slug', business_record.public_slug);
  end if;

  select id into location_id_value
  from public.locations
  where business_id = target_business_id and status = 'active'
  order by created_at
  limit 1;

  if location_id_value is null then
    raise exception 'complete an active location before launch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from app.get_business_setup_readiness(target_business_id)
    where not (business_profile_complete and location_profile_complete and operating_hours_complete)
  ) then
    raise exception 'complete the business profile before launch' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.services where business_id = target_business_id
  ) then
    raise exception 'add at least one service before launch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.services service
    where service.business_id = target_business_id
      and not exists (
        select 1
        from public.capacity_pools pool
        where pool.business_id = service.business_id
          and pool.service_id = service.id
          and pool.location_id = location_id_value
          and pool.status = 'active'
      )
  ) then
    raise exception 'set capacity for every service before launch' using errcode = '22023';
  end if;

  select id into price_version_id_value
  from public.price_book_versions
  where business_id = target_business_id and status = 'draft'
  order by version_number desc
  limit 1;

  select id into policy_version_id_value
  from public.commercial_policy_versions
  where business_id = target_business_id
    and location_id = location_id_value
    and status = 'draft'
  order by version_number desc
  limit 1;

  if price_version_id_value is null or policy_version_id_value is null then
    raise exception 'complete pricing and policies before launch' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.price_rate_rules
    where business_id = target_business_id
      and price_book_version_id = price_version_id_value
  ) then
    raise exception 'add at least one rate before launch' using errcode = '22023';
  end if;

  select * into website_record
  from public.tenant_websites
  where business_id = target_business_id
  for update;

  website_readiness := app.get_tenant_website_readiness(target_business_id);
  if website_record.id is null
    or website_readiness is null
    or not (
      coalesce((website_readiness->>'hero')::boolean, false)
      and coalesce((website_readiness->>'about')::boolean, false)
      and coalesce((website_readiness->>'faq')::boolean, false)
      and coalesce((website_readiness->>'contact')::boolean, false)
      and coalesce((website_readiness->>'brand')::boolean, false)
    )
  then
    raise exception 'complete the customer website before launch' using errcode = '22023';
  end if;

  for service_record in
    select service.id as service_id, version.id as version_id
    from public.services service
    join lateral (
      select id
      from public.service_versions
      where business_id = service.business_id
        and service_id = service.id
        and status = 'draft'
      order by version_number desc
      limit 1
    ) version on true
    where service.business_id = target_business_id
  loop
    perform app.publish_service_version(
      target_business_id,
      service_record.service_id,
      service_record.version_id,
      location_id_value,
      true,
      true,
      true,
      true
    );
  end loop;

  perform app.publish_pricing_bundle(
    target_business_id,
    price_version_id_value,
    policy_version_id_value,
    current_date
  );
  perform app.publish_tenant_website(target_business_id, null);

  update public.businesses
  set status = 'active'
  where id = target_business_id;

  return jsonb_build_object('status', 'active', 'public_slug', business_record.public_slug);
end;
$$;

revoke all on function app.launch_tenant_business(uuid) from public;
grant execute on function app.launch_tenant_business(uuid) to authenticated;
