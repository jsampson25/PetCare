-- PetCare E04 pet feeding plan foundation.

create table public.pet_feeding_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  food_name text not null check (char_length(trim(food_name)) between 1 and 200),
  food_source text not null check (food_source in ('customer_provided', 'business_provided')),
  amount_per_meal text not null check (char_length(trim(amount_per_meal)) between 1 and 120),
  meals_per_day smallint not null check (meals_per_day between 1 and 8),
  schedule_description text not null check (char_length(trim(schedule_description)) between 1 and 500),
  preparation_instructions text not null check (char_length(trim(preparation_instructions)) between 1 and 1000),
  supplement_instructions text,
  feed_separately boolean not null default false,
  separate_feeding_reason text,
  information_source text not null check (information_source in ('customer_reported', 'staff_confirmed', 'veterinary_documented')),
  status text not null default 'active' check (status in ('active', 'discontinued')),
  discontinued_reason text,
  discontinued_by uuid references auth.users (id) on delete set null,
  discontinued_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (not feed_separately or char_length(trim(coalesce(separate_feeding_reason, ''))) > 0),
  check ((discontinued_at is null) = (discontinued_by is null)),
  check (status <> 'discontinued' or char_length(trim(coalesce(discontinued_reason, ''))) > 0)
);

create unique index pet_feeding_plans_one_active_idx
on public.pet_feeding_plans (business_id, pet_id)
where status = 'active';

create trigger pet_feeding_plans_set_updated_at before update on public.pet_feeding_plans
for each row execute function app.set_updated_at();
create trigger pet_feeding_plans_prevent_business_change before update on public.pet_feeding_plans
for each row execute function app.prevent_business_id_change();
create trigger pet_feeding_plans_audit after insert or update or delete on public.pet_feeding_plans
for each row execute function app.audit_configuration_change('pet.feeding_plan.changed', 'pet_feeding_plan');

create or replace function app.add_pet_feeding_plan(
  target_business_id uuid,
  target_pet_id uuid,
  food_product text,
  source_type text,
  meal_amount text,
  daily_meal_count integer,
  schedule_text text,
  preparation_text text,
  supplement_text text,
  requires_separate_feeding boolean,
  separation_reason text,
  information_source_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'feeding management unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.pet_feeding_plans
    where business_id = target_business_id and pet_id = target_pet_id and status = 'active'
  ) then
    raise exception 'active feeding plan already exists' using errcode = '23505';
  end if;
  if char_length(trim(coalesce(food_product, ''))) < 1
    or source_type not in ('customer_provided', 'business_provided')
    or char_length(trim(coalesce(meal_amount, ''))) < 1
    or daily_meal_count not between 1 and 8
    or char_length(trim(coalesce(schedule_text, ''))) < 1
    or char_length(trim(coalesce(preparation_text, ''))) < 1
    or (coalesce(requires_separate_feeding, false) and char_length(trim(coalesce(separation_reason, ''))) < 1)
    or information_source_type not in ('customer_reported', 'staff_confirmed', 'veterinary_documented') then
    raise exception 'invalid feeding plan' using errcode = '22023';
  end if;

  insert into public.pet_feeding_plans (
    business_id, pet_id, food_name, food_source, amount_per_meal, meals_per_day,
    schedule_description, preparation_instructions, supplement_instructions,
    feed_separately, separate_feeding_reason, information_source
  ) values (
    target_business_id, target_pet_id, trim(food_product), source_type, trim(meal_amount),
    daily_meal_count, trim(schedule_text), trim(preparation_text), nullif(trim(supplement_text), ''),
    coalesce(requires_separate_feeding, false),
    case when coalesce(requires_separate_feeding, false) then trim(separation_reason) else null end,
    information_source_type
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function app.discontinue_pet_feeding_plan(
  target_business_id uuid,
  feeding_plan_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'feeding management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 1 then
    raise exception 'discontinuation reason required' using errcode = '22023';
  end if;
  update public.pet_feeding_plans set
    status = 'discontinued', discontinued_reason = trim(reason),
    discontinued_by = auth.uid(), discontinued_at = now()
  where business_id = target_business_id and id = feeding_plan_id and status = 'active';
  if not found then raise exception 'feeding plan unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_feeding_plans enable row level security;
alter table public.pet_feeding_plans force row level security;
create policy pet_feeding_plans_select on public.pet_feeding_plans for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_feeding_plans_manage on public.pet_feeding_plans for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_feeding_plans from anon, authenticated;
grant select on public.pet_feeding_plans to authenticated;
revoke all on function app.add_pet_feeding_plan(uuid, uuid, text, text, text, integer, text, text, text, boolean, text, text) from public;
grant execute on function app.add_pet_feeding_plan(uuid, uuid, text, text, text, integer, text, text, text, boolean, text, text) to authenticated;
revoke all on function app.discontinue_pet_feeding_plan(uuid, uuid, text) from public;
grant execute on function app.discontinue_pet_feeding_plan(uuid, uuid, text) to authenticated;
