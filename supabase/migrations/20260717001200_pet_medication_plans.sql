-- PetCare E04 pet medication plan foundation.

create table public.pet_medication_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  medication_name text not null check (char_length(trim(medication_name)) between 1 and 160),
  dose text not null check (char_length(trim(dose)) between 1 and 120),
  route text not null check (route in ('oral', 'topical', 'otic', 'ophthalmic', 'inhaled', 'injection', 'other')),
  schedule_description text not null check (char_length(trim(schedule_description)) between 1 and 500),
  administration_instructions text not null check (char_length(trim(administration_instructions)) between 1 and 1000),
  as_needed boolean not null default false,
  as_needed_reason text,
  starts_on date,
  ends_on date,
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
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (not as_needed or char_length(trim(coalesce(as_needed_reason, ''))) > 0),
  check ((discontinued_at is null) = (discontinued_by is null)),
  check (status <> 'discontinued' or char_length(trim(coalesce(discontinued_reason, ''))) > 0)
);

create index pet_medication_plans_active_idx
on public.pet_medication_plans (business_id, pet_id, medication_name)
where status = 'active';

create trigger pet_medication_plans_set_updated_at before update on public.pet_medication_plans
for each row execute function app.set_updated_at();
create trigger pet_medication_plans_prevent_business_change before update on public.pet_medication_plans
for each row execute function app.prevent_business_id_change();
create trigger pet_medication_plans_audit after insert or update or delete on public.pet_medication_plans
for each row execute function app.audit_configuration_change('pet.medication_plan.changed', 'pet_medication_plan');

create or replace function app.add_pet_medication_plan(
  target_business_id uuid,
  target_pet_id uuid,
  medication text,
  medication_dose text,
  administration_route text,
  schedule_text text,
  instruction_text text,
  is_as_needed boolean,
  as_needed_indication text,
  effective_start date,
  effective_end date,
  source_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'medication management unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if char_length(trim(coalesce(medication, ''))) < 1
    or char_length(trim(coalesce(medication_dose, ''))) < 1
    or administration_route not in ('oral', 'topical', 'otic', 'ophthalmic', 'inhaled', 'injection', 'other')
    or char_length(trim(coalesce(schedule_text, ''))) < 1
    or char_length(trim(coalesce(instruction_text, ''))) < 1
    or (coalesce(is_as_needed, false) and char_length(trim(coalesce(as_needed_indication, ''))) < 1)
    or (effective_end is not null and effective_start is not null and effective_end < effective_start)
    or source_type not in ('customer_reported', 'staff_confirmed', 'veterinary_documented') then
    raise exception 'invalid medication plan' using errcode = '22023';
  end if;

  insert into public.pet_medication_plans (
    business_id, pet_id, medication_name, dose, route, schedule_description,
    administration_instructions, as_needed, as_needed_reason, starts_on, ends_on, information_source
  ) values (
    target_business_id, target_pet_id, trim(medication), trim(medication_dose), administration_route,
    trim(schedule_text), trim(instruction_text), coalesce(is_as_needed, false),
    case when coalesce(is_as_needed, false) then trim(as_needed_indication) else null end,
    effective_start, effective_end, source_type
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function app.discontinue_pet_medication_plan(
  target_business_id uuid,
  medication_plan_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'medication management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 1 then
    raise exception 'discontinuation reason required' using errcode = '22023';
  end if;
  update public.pet_medication_plans set
    status = 'discontinued', discontinued_reason = trim(reason),
    discontinued_by = auth.uid(), discontinued_at = now()
  where business_id = target_business_id and id = medication_plan_id and status = 'active';
  if not found then raise exception 'medication plan unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_medication_plans enable row level security;
alter table public.pet_medication_plans force row level security;
create policy pet_medication_plans_select on public.pet_medication_plans for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_medication_plans_manage on public.pet_medication_plans for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_medication_plans from anon, authenticated;
grant select on public.pet_medication_plans to authenticated;
revoke all on function app.add_pet_medication_plan(uuid, uuid, text, text, text, text, text, boolean, text, date, date, text) from public;
grant execute on function app.add_pet_medication_plan(uuid, uuid, text, text, text, text, text, boolean, text, date, date, text) to authenticated;
revoke all on function app.discontinue_pet_medication_plan(uuid, uuid, text) from public;
grant execute on function app.discontinue_pet_medication_plan(uuid, uuid, text) to authenticated;
