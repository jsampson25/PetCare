-- PetCare E03 business profile, location profile, weekly hours, and setup readiness.

alter table public.businesses
  add column legal_name text check (legal_name is null or char_length(trim(legal_name)) between 1 and 200),
  add column customer_email text check (customer_email is null or (customer_email = lower(trim(customer_email)) and position('@' in customer_email) > 1)),
  add column customer_phone text check (customer_phone is null or char_length(trim(customer_phone)) between 7 and 30),
  add column country_code text not null default 'US' check (country_code ~ '^[A-Z]{2}$'),
  add column locale text not null default 'en-US' check (char_length(locale) between 2 and 35),
  add column currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  add column default_time_zone text not null default 'America/Chicago' check (char_length(default_time_zone) between 1 and 80);

alter table public.locations
  add column customer_email text check (customer_email is null or (customer_email = lower(trim(customer_email)) and position('@' in customer_email) > 1)),
  add column customer_phone text check (customer_phone is null or char_length(trim(customer_phone)) between 7 and 30),
  add column address_line_1 text check (address_line_1 is null or char_length(trim(address_line_1)) between 1 and 160),
  add column address_line_2 text check (address_line_2 is null or char_length(trim(address_line_2)) between 1 and 160),
  add column city text check (city is null or char_length(trim(city)) between 1 and 100),
  add column region text check (region is null or char_length(trim(region)) between 1 and 100),
  add column postal_code text check (postal_code is null or char_length(trim(postal_code)) between 2 and 20),
  add column country_code text not null default 'US' check (country_code ~ '^[A-Z]{2}$'),
  add column arrival_instructions text check (arrival_instructions is null or char_length(arrival_instructions) <= 2000);

create table public.location_operating_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  location_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, location_id, day_of_week),
  foreign key (business_id, location_id)
    references public.locations (business_id, id) on delete cascade,
  check (
    (is_closed and opens_at is null and closes_at is null)
    or (not is_closed and opens_at is not null and closes_at is not null and opens_at < closes_at)
  )
);

create index location_operating_hours_location_idx
  on public.location_operating_hours (business_id, location_id, day_of_week);

create trigger location_operating_hours_set_updated_at
before update on public.location_operating_hours
for each row execute function app.set_updated_at();

create trigger location_operating_hours_prevent_business_change
before update on public.location_operating_hours
for each row execute function app.prevent_business_id_change();

create or replace function app.audit_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_business_id uuid;
  target_entity_id uuid;
begin
  if tg_table_name = 'businesses' then
    target_business_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    target_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
  end if;
  target_entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
  perform app.write_audit_event(
    target_business_id,
    auth.uid(),
    tg_argv[0],
    tg_argv[1],
    target_entity_id,
    jsonb_build_object('operation', lower(tg_op))
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger businesses_audit_profile_update
after update of name, legal_name, customer_email, customer_phone, country_code, locale, currency_code, default_time_zone
on public.businesses
for each row execute function app.audit_configuration_change('business.profile_updated', 'business');

create trigger locations_audit_profile_update
after update of name, customer_email, customer_phone, address_line_1, address_line_2, city, region, postal_code, country_code, time_zone, arrival_instructions
on public.locations
for each row execute function app.audit_configuration_change('location.profile_updated', 'location');

create trigger location_operating_hours_audit
after insert or update or delete on public.location_operating_hours
for each row execute function app.audit_configuration_change('location.hours_changed', 'location_operating_hours');

create or replace function app.get_business_setup_readiness(target_business_id uuid)
returns table (
  business_profile_complete boolean,
  location_profile_complete boolean,
  operating_hours_complete boolean,
  completed_steps integer,
  total_steps integer,
  completion_percent integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with access as (
    select app.member_has_permission(target_business_id, 'business.manage_profile') as allowed
  ),
  business_check as (
    select (
      business.legal_name is not null
      and business.customer_email is not null
      and business.customer_phone is not null
      and business.default_time_zone is not null
    ) as complete
    from public.businesses business, access
    where business.id = target_business_id and access.allowed
  ),
  location_check as (
    select exists (
      select 1 from public.locations location
      where location.business_id = target_business_id
        and location.address_line_1 is not null
        and location.city is not null
        and location.region is not null
        and location.postal_code is not null
        and location.customer_email is not null
        and location.customer_phone is not null
        and location.time_zone is not null
    ) as complete
    from access
    where access.allowed
  ),
  hours_check as (
    select exists (
      select 1
      from public.location_operating_hours hours
      where hours.business_id = target_business_id
      group by hours.location_id
      having count(*) = 7 and count(*) filter (where not hours.is_closed) >= 1
    ) as complete
    from access
    where access.allowed
  ),
  checks as (
    select
      coalesce((select complete from business_check), false) as business_complete,
      coalesce((select complete from location_check), false) as location_complete,
      coalesce((select complete from hours_check), false) as hours_complete
  )
  select
    business_complete,
    location_complete,
    hours_complete,
    business_complete::integer + location_complete::integer + hours_complete::integer,
    3,
    ((business_complete::integer + location_complete::integer + hours_complete::integer) * 100 / 3)
  from checks;
$$;

create or replace function app.save_business_onboarding_foundation(
  target_business_id uuid,
  target_location_id uuid,
  target_legal_name text,
  target_customer_email text,
  target_customer_phone text,
  target_country_code text,
  target_locale text,
  target_currency_code text,
  target_time_zone text,
  target_address_line_1 text,
  target_address_line_2 text,
  target_city text,
  target_region text,
  target_postal_code text,
  target_weekday_open time,
  target_weekday_close time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'business.manage_profile')
    or not app.member_has_permission(target_business_id, 'business.manage_locations')
    or not app.member_can_access_location(target_business_id, target_location_id) then
    raise exception 'setup unavailable' using errcode = '42501';
  end if;
  if target_weekday_open is null or target_weekday_close is null
    or target_weekday_open >= target_weekday_close then
    raise exception 'invalid operating hours' using errcode = '22023';
  end if;

  update public.businesses set
    legal_name = trim(target_legal_name),
    customer_email = lower(trim(target_customer_email)),
    customer_phone = trim(target_customer_phone),
    country_code = upper(trim(target_country_code)),
    locale = trim(target_locale),
    currency_code = upper(trim(target_currency_code)),
    default_time_zone = trim(target_time_zone)
  where id = target_business_id;

  update public.locations set
    customer_email = lower(trim(target_customer_email)),
    customer_phone = trim(target_customer_phone),
    address_line_1 = trim(target_address_line_1),
    address_line_2 = nullif(trim(target_address_line_2), ''),
    city = trim(target_city),
    region = trim(target_region),
    postal_code = trim(target_postal_code),
    country_code = upper(trim(target_country_code)),
    time_zone = trim(target_time_zone)
  where business_id = target_business_id and id = target_location_id;

  if not found then
    raise exception 'setup unavailable' using errcode = 'P0002';
  end if;

  insert into public.location_operating_hours (
    business_id, location_id, day_of_week, is_closed, opens_at, closes_at
  )
  select
    target_business_id,
    target_location_id,
    day_number,
    day_number in (0, 6),
    case when day_number in (0, 6) then null else target_weekday_open end,
    case when day_number in (0, 6) then null else target_weekday_close end
  from generate_series(0, 6) day_number
  on conflict (business_id, location_id, day_of_week) do update
  set is_closed = excluded.is_closed,
      opens_at = excluded.opens_at,
      closes_at = excluded.closes_at;
end;
$$;

alter table public.location_operating_hours enable row level security;
alter table public.location_operating_hours force row level security;

create policy location_operating_hours_select_scoped_member
on public.location_operating_hours for select to authenticated
using (app.member_can_access_location(business_id, location_id));

create policy location_operating_hours_insert_manager
on public.location_operating_hours for insert to authenticated
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

create policy location_operating_hours_update_manager
on public.location_operating_hours for update to authenticated
using (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
)
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

create policy location_operating_hours_delete_manager
on public.location_operating_hours for delete to authenticated
using (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

grant update (
  legal_name, customer_email, customer_phone, country_code, locale, currency_code, default_time_zone
) on public.businesses to authenticated;
grant update (
  customer_email, customer_phone, address_line_1, address_line_2, city, region,
  postal_code, country_code, time_zone, arrival_instructions
) on public.locations to authenticated;
revoke all on public.location_operating_hours from anon, authenticated;
grant select, insert, update, delete on public.location_operating_hours to authenticated;

revoke all on function app.audit_configuration_change() from public;
revoke all on function app.get_business_setup_readiness(uuid) from public;
revoke all on function app.save_business_onboarding_foundation(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, time, time) from public;
grant execute on function app.get_business_setup_readiness(uuid) to authenticated;
grant execute on function app.save_business_onboarding_foundation(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, time, time) to authenticated;
