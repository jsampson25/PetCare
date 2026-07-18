-- PetCare E04 complete pet identity details and weight history.

alter table public.pets
  add column preferred_name text,
  add column color_markings text,
  add column altered_status text not null default 'unknown'
    check (altered_status in ('altered', 'intact', 'unknown'));

create table public.pet_weight_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  weight_kg numeric(6, 2) not null check (weight_kg > 0 and weight_kg <= 250),
  reported_value numeric(7, 2) not null check (reported_value > 0),
  reported_unit text not null check (reported_unit in ('lb', 'kg')),
  measured_on date not null check (measured_on <= current_date),
  information_source text not null check (information_source in ('customer_reported', 'staff_measured', 'veterinary_documented')),
  note text,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict
);

create index pet_weight_records_recent_idx
on public.pet_weight_records (business_id, pet_id, measured_on desc, created_at desc);

create trigger pet_weight_records_prevent_business_change before update on public.pet_weight_records
for each row execute function app.prevent_business_id_change();
create trigger pet_weight_records_audit after insert or update or delete on public.pet_weight_records
for each row execute function app.audit_configuration_change('pet.weight_record.changed', 'pet_weight_record');

create or replace function app.update_pet_identity(
  target_business_id uuid,
  target_pet_id uuid,
  legal_name text,
  preferred_name_text text,
  breed_text text,
  color_markings_text text,
  sex_value text,
  alteration_value text,
  date_of_birth date,
  birth_date_estimated boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'pet identity management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(legal_name, ''))) < 1
    or char_length(trim(coalesce(breed_text, ''))) < 1
    or sex_value not in ('female', 'male', 'unknown')
    or alteration_value not in ('altered', 'intact', 'unknown')
    or (date_of_birth is not null and date_of_birth > current_date)
    or (date_of_birth is null and birth_date_estimated) then
    raise exception 'invalid pet identity' using errcode = '22023';
  end if;

  update public.pets set
    name = trim(legal_name),
    preferred_name = nullif(trim(preferred_name_text), ''),
    breed = trim(breed_text),
    color_markings = nullif(trim(color_markings_text), ''),
    sex = sex_value,
    altered_status = alteration_value,
    birth_date = date_of_birth,
    birth_date_is_estimated = birth_date_estimated
  where business_id = target_business_id and id = target_pet_id;
  if not found then raise exception 'pet unavailable' using errcode = 'P0002'; end if;
end;
$$;

create or replace function app.add_pet_weight_record(
  target_business_id uuid,
  target_pet_id uuid,
  weight_value numeric,
  weight_unit text,
  measurement_date date,
  source_type text,
  note_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_kg numeric(6, 2); created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'pet weight management unavailable' using errcode = '42501';
  end if;
  if weight_value is null or weight_value <= 0
    or weight_unit not in ('lb', 'kg')
    or measurement_date is null or measurement_date > current_date
    or source_type not in ('customer_reported', 'staff_measured', 'veterinary_documented') then
    raise exception 'invalid pet weight' using errcode = '22023';
  end if;
  normalized_kg := round(case when weight_unit = 'lb' then weight_value * 0.45359237 else weight_value end, 2);
  if normalized_kg <= 0 or normalized_kg > 250 then
    raise exception 'invalid pet weight' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;

  insert into public.pet_weight_records (
    business_id, pet_id, weight_kg, reported_value, reported_unit, measured_on, information_source, note
  ) values (
    target_business_id, target_pet_id, normalized_kg, weight_value, weight_unit,
    measurement_date, source_type, nullif(trim(note_text), '')
  ) returning id into created_id;
  return created_id;
end;
$$;

alter table public.pet_weight_records enable row level security;
alter table public.pet_weight_records force row level security;
create policy pet_weight_records_select on public.pet_weight_records for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_weight_records_manage on public.pet_weight_records for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_weight_records from anon, authenticated;
grant select on public.pet_weight_records to authenticated;
revoke all on function app.update_pet_identity(uuid, uuid, text, text, text, text, text, text, date, boolean) from public;
grant execute on function app.update_pet_identity(uuid, uuid, text, text, text, text, text, text, date, boolean) to authenticated;
revoke all on function app.add_pet_weight_record(uuid, uuid, numeric, text, date, text, text) from public;
grant execute on function app.add_pet_weight_record(uuid, uuid, numeric, text, date, text, text) to authenticated;
