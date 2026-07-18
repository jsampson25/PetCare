-- PetCare E04 structured pet allergy safety records.

create table public.pet_allergies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  allergen text not null check (char_length(trim(allergen)) between 1 and 160),
  category text not null check (category in ('food', 'medication', 'environmental', 'contact', 'other')),
  severity text not null check (severity in ('mild', 'moderate', 'severe', 'life_threatening')),
  reaction text not null check (char_length(trim(reaction)) between 1 and 500),
  care_instructions text not null check (char_length(trim(care_instructions)) between 1 and 1000),
  information_source text not null check (information_source in ('customer_reported', 'staff_observed', 'veterinary_documented')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  resolved_reason text,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check ((resolved_at is null) = (resolved_by is null)),
  check (status <> 'resolved' or char_length(trim(coalesce(resolved_reason, ''))) > 0)
);

create index pet_allergies_active_idx
on public.pet_allergies (business_id, pet_id, severity)
where status = 'active';

create trigger pet_allergies_set_updated_at before update on public.pet_allergies
for each row execute function app.set_updated_at();
create trigger pet_allergies_prevent_business_change before update on public.pet_allergies
for each row execute function app.prevent_business_id_change();
create trigger pet_allergies_audit after insert or update or delete on public.pet_allergies
for each row execute function app.audit_configuration_change('pet.allergy.changed', 'pet_allergy');

create or replace function app.add_pet_allergy(
  target_business_id uuid,
  target_pet_id uuid,
  allergen_name text,
  allergy_category text,
  allergy_severity text,
  reaction_description text,
  handling_instructions text,
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
    raise exception 'allergy management unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if char_length(trim(coalesce(allergen_name, ''))) < 1
    or allergy_category not in ('food', 'medication', 'environmental', 'contact', 'other')
    or allergy_severity not in ('mild', 'moderate', 'severe', 'life_threatening')
    or char_length(trim(coalesce(reaction_description, ''))) < 1
    or char_length(trim(coalesce(handling_instructions, ''))) < 1
    or source_type not in ('customer_reported', 'staff_observed', 'veterinary_documented') then
    raise exception 'invalid allergy record' using errcode = '22023';
  end if;

  insert into public.pet_allergies (
    business_id, pet_id, allergen, category, severity, reaction, care_instructions, information_source
  ) values (
    target_business_id, target_pet_id, trim(allergen_name), allergy_category, allergy_severity,
    trim(reaction_description), trim(handling_instructions), source_type
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function app.resolve_pet_allergy(
  target_business_id uuid,
  allergy_id uuid,
  resolution_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'allergy management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(resolution_reason, ''))) < 1 then
    raise exception 'resolution reason required' using errcode = '22023';
  end if;
  update public.pet_allergies set
    status = 'resolved', resolved_reason = trim(resolution_reason),
    resolved_by = auth.uid(), resolved_at = now()
  where business_id = target_business_id and id = allergy_id and status = 'active';
  if not found then raise exception 'allergy unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_allergies enable row level security;
alter table public.pet_allergies force row level security;
create policy pet_allergies_select on public.pet_allergies for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_allergies_manage on public.pet_allergies for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_allergies from anon, authenticated;
grant select on public.pet_allergies to authenticated;
revoke all on function app.add_pet_allergy(uuid, uuid, text, text, text, text, text, text) from public;
grant execute on function app.add_pet_allergy(uuid, uuid, text, text, text, text, text, text) to authenticated;
revoke all on function app.resolve_pet_allergy(uuid, uuid, text) from public;
grant execute on function app.resolve_pet_allergy(uuid, uuid, text) to authenticated;
