-- PetCare E04 additional household pets.

create or replace function app.add_pet_to_customer_household(
  target_business_id uuid,
  target_customer_id uuid,
  pet_name text,
  pet_breed text,
  pet_birth_date date,
  pet_birth_date_is_estimated boolean,
  pet_sex text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid;
  created_pet_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'customers.view')
    or not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'pet creation unavailable' using errcode = '42501';
  end if;

  select membership.household_id into target_household_id
  from public.household_members membership
  join public.households household
    on household.business_id = membership.business_id
   and household.id = membership.household_id
   and household.status = 'active'
  where membership.business_id = target_business_id
    and membership.customer_id = target_customer_id
  order by case membership.role when 'administrator' then 0 else 1 end, membership.created_at
  limit 1;

  if target_household_id is null then
    raise exception 'customer household unavailable' using errcode = 'P0002';
  end if;

  if char_length(trim(coalesce(pet_name, ''))) < 1
    or char_length(trim(coalesce(pet_breed, ''))) < 1
    or pet_sex not in ('female', 'male', 'unknown')
    or (pet_birth_date is not null and pet_birth_date > current_date) then
    raise exception 'invalid pet profile' using errcode = '22023';
  end if;

  insert into public.pets (
    business_id, household_id, name, breed, birth_date, birth_date_is_estimated, sex
  ) values (
    target_business_id,
    target_household_id,
    trim(pet_name),
    trim(pet_breed),
    pet_birth_date,
    coalesce(pet_birth_date_is_estimated, false),
    pet_sex
  )
  returning id into created_pet_id;

  return created_pet_id;
end;
$$;

revoke all on function app.add_pet_to_customer_household(uuid, uuid, text, text, date, boolean, text) from public;
grant execute on function app.add_pet_to_customer_household(uuid, uuid, text, text, date, boolean, text) to authenticated;
