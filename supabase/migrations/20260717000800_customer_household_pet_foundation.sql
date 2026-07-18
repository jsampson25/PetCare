-- PetCare E04 customer, household, and first-pet foundation.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  preferred_name text check (preferred_name is null or char_length(trim(preferred_name)) between 1 and 100),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  phone text not null check (char_length(trim(phone)) between 7 and 30),
  status text not null default 'active' check (status in ('active', 'inactive', 'restricted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, email)
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  household_id uuid not null,
  customer_id uuid not null,
  role text not null check (role in ('administrator', 'adult_member')),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, household_id, customer_id),
  foreign key (business_id, household_id)
    references public.households (business_id, id) on delete cascade,
  foreign key (business_id, customer_id)
    references public.customers (business_id, id) on delete cascade
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  household_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 100),
  species text not null default 'dog' check (species in ('dog')),
  breed text not null check (char_length(trim(breed)) between 1 and 120),
  birth_date date,
  birth_date_is_estimated boolean not null default false,
  sex text not null check (sex in ('female', 'male', 'unknown')),
  status text not null default 'active' check (status in ('active', 'inactive', 'deceased', 'restricted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, household_id)
    references public.households (business_id, id) on delete restrict
);

create index customers_name_idx on public.customers (business_id, last_name, first_name);
create index households_name_idx on public.households (business_id, display_name);
create index household_members_customer_idx on public.household_members (business_id, customer_id);
create index pets_household_idx on public.pets (business_id, household_id, name);

create trigger customers_set_updated_at before update on public.customers
for each row execute function app.set_updated_at();
create trigger households_set_updated_at before update on public.households
for each row execute function app.set_updated_at();
create trigger pets_set_updated_at before update on public.pets
for each row execute function app.set_updated_at();

create trigger customers_prevent_business_change before update on public.customers
for each row execute function app.prevent_business_id_change();
create trigger households_prevent_business_change before update on public.households
for each row execute function app.prevent_business_id_change();
create trigger household_members_prevent_business_change before update on public.household_members
for each row execute function app.prevent_business_id_change();
create trigger pets_prevent_business_change before update on public.pets
for each row execute function app.prevent_business_id_change();

create trigger customers_audit after insert or update or delete on public.customers
for each row execute function app.audit_configuration_change('customer.changed', 'customer');
create trigger households_audit after insert or update or delete on public.households
for each row execute function app.audit_configuration_change('household.changed', 'household');
create trigger pets_audit after insert or update or delete on public.pets
for each row execute function app.audit_configuration_change('pet.changed', 'pet');

create or replace function app.create_customer_household_with_pet(
  target_business_id uuid,
  customer_first_name text,
  customer_last_name text,
  customer_preferred_name text,
  customer_email text,
  customer_phone text,
  pet_name text,
  pet_breed text,
  pet_birth_date date,
  pet_birth_date_is_estimated boolean,
  pet_sex text
)
returns table (customer_id uuid, household_id uuid, pet_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_customer_id uuid;
  created_household_id uuid;
  created_pet_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'customers.manage')
    or not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'customer creation unavailable' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(customer_first_name, ''))) < 1
    or char_length(trim(coalesce(customer_last_name, ''))) < 1
    or position('@' in lower(trim(coalesce(customer_email, '')))) <= 1
    or char_length(trim(coalesce(customer_phone, ''))) < 7
    or char_length(trim(coalesce(pet_name, ''))) < 1
    or char_length(trim(coalesce(pet_breed, ''))) < 1
    or pet_sex not in ('female', 'male', 'unknown')
    or (pet_birth_date is not null and pet_birth_date > current_date) then
    raise exception 'invalid customer or pet profile' using errcode = '22023';
  end if;

  insert into public.customers (
    business_id, first_name, last_name, preferred_name, email, phone
  ) values (
    target_business_id,
    trim(customer_first_name),
    trim(customer_last_name),
    nullif(trim(customer_preferred_name), ''),
    lower(trim(customer_email)),
    trim(customer_phone)
  )
  returning id into created_customer_id;

  insert into public.households (business_id, display_name)
  values (target_business_id, trim(customer_last_name) || ' household')
  returning id into created_household_id;

  insert into public.household_members (
    business_id, household_id, customer_id, role
  ) values (
    target_business_id, created_household_id, created_customer_id, 'administrator'
  );

  insert into public.pets (
    business_id, household_id, name, breed, birth_date, birth_date_is_estimated, sex
  ) values (
    target_business_id,
    created_household_id,
    trim(pet_name),
    trim(pet_breed),
    pet_birth_date,
    coalesce(pet_birth_date_is_estimated, false),
    pet_sex
  )
  returning id into created_pet_id;

  return query select created_customer_id, created_household_id, created_pet_id;
exception
  when unique_violation then
    raise exception 'customer email already exists' using errcode = '23505';
end;
$$;

alter table public.customers enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.pets enable row level security;
alter table public.customers force row level security;
alter table public.households force row level security;
alter table public.household_members force row level security;
alter table public.pets force row level security;

create policy customers_select on public.customers for select to authenticated
using (app.member_has_permission(business_id, 'customers.view'));
create policy customers_manage on public.customers for all to authenticated
using (app.member_has_permission(business_id, 'customers.manage'))
with check (app.member_has_permission(business_id, 'customers.manage'));

create policy households_select on public.households for select to authenticated
using (app.member_has_permission(business_id, 'customers.view'));
create policy households_manage on public.households for all to authenticated
using (app.member_has_permission(business_id, 'customers.manage'))
with check (app.member_has_permission(business_id, 'customers.manage'));

create policy household_members_select on public.household_members for select to authenticated
using (app.member_has_permission(business_id, 'customers.view'));
create policy household_members_manage on public.household_members for all to authenticated
using (app.member_has_permission(business_id, 'customers.manage'))
with check (app.member_has_permission(business_id, 'customers.manage'));

create policy pets_select on public.pets for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pets_manage on public.pets for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.customers, public.households, public.household_members, public.pets from anon, authenticated;
grant select, insert, update, delete on public.customers, public.households, public.household_members, public.pets to authenticated;
revoke all on function app.create_customer_household_with_pet(uuid, text, text, text, text, text, text, text, date, boolean, text) from public;
grant execute on function app.create_customer_household_with_pet(uuid, text, text, text, text, text, text, text, date, boolean, text) to authenticated;
