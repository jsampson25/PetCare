-- PetCare E04 structured, versioned grooming preferences.

create table public.pet_grooming_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  coat_type text not null check (coat_type in ('short', 'double', 'long', 'curly', 'wire', 'hairless', 'mixed', 'unknown')),
  coat_condition text not null check (coat_condition in ('healthy', 'matted', 'dry', 'oily', 'sensitive', 'unknown')),
  sensitivity_level text not null check (sensitivity_level in ('none', 'low', 'moderate', 'high')),
  sensitivity_details text,
  preferred_length text,
  style_notes text,
  handling_constraints text,
  preferred_groomer text,
  nail_service text not null check (nail_service in ('no_preference', 'trim', 'grind', 'decline')),
  ear_cleaning boolean not null default false,
  teeth_brushing boolean not null default false,
  information_source text not null check (information_source in ('customer_reported', 'staff_confirmed', 'groomer_observed')),
  status text not null default 'current' check (status in ('current', 'superseded')),
  superseded_reason text,
  superseded_by uuid references auth.users (id) on delete set null,
  superseded_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (sensitivity_level = 'none' or char_length(trim(coalesce(sensitivity_details, ''))) > 0),
  check ((superseded_at is null) = (superseded_by is null)),
  check (status <> 'superseded' or char_length(trim(coalesce(superseded_reason, ''))) > 0)
);

create unique index pet_grooming_profiles_one_current_idx
on public.pet_grooming_profiles (business_id, pet_id)
where status = 'current';
create index pet_grooming_profiles_history_idx
on public.pet_grooming_profiles (business_id, pet_id, created_at desc);

create trigger pet_grooming_profiles_set_updated_at before update on public.pet_grooming_profiles
for each row execute function app.set_updated_at();
create trigger pet_grooming_profiles_prevent_business_change before update on public.pet_grooming_profiles
for each row execute function app.prevent_business_id_change();
create trigger pet_grooming_profiles_audit after insert or update or delete on public.pet_grooming_profiles
for each row execute function app.audit_configuration_change('pet.grooming_profile.changed', 'pet_grooming_profile');

create or replace function app.replace_pet_grooming_profile(
  target_business_id uuid,
  target_pet_id uuid,
  coat_type_value text,
  coat_condition_value text,
  sensitivity_value text,
  sensitivity_text text,
  preferred_length_text text,
  style_note_text text,
  handling_constraint_text text,
  preferred_groomer_text text,
  nail_service_value text,
  include_ear_cleaning boolean,
  include_teeth_brushing boolean,
  source_type text,
  change_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare current_id uuid; created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'grooming profile management unavailable' using errcode = '42501';
  end if;
  if coat_type_value not in ('short', 'double', 'long', 'curly', 'wire', 'hairless', 'mixed', 'unknown')
    or coat_condition_value not in ('healthy', 'matted', 'dry', 'oily', 'sensitive', 'unknown')
    or sensitivity_value not in ('none', 'low', 'moderate', 'high')
    or (sensitivity_value <> 'none' and char_length(trim(coalesce(sensitivity_text, ''))) < 1)
    or nail_service_value not in ('no_preference', 'trim', 'grind', 'decline')
    or source_type not in ('customer_reported', 'staff_confirmed', 'groomer_observed') then
    raise exception 'invalid grooming profile' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;

  select id into current_id from public.pet_grooming_profiles
  where business_id = target_business_id and pet_id = target_pet_id and status = 'current'
  for update;
  if current_id is not null and char_length(trim(coalesce(change_reason, ''))) < 1 then
    raise exception 'grooming profile change reason required' using errcode = '22023';
  end if;
  if current_id is not null then
    update public.pet_grooming_profiles set
      status = 'superseded', superseded_reason = trim(change_reason),
      superseded_by = auth.uid(), superseded_at = now()
    where business_id = target_business_id and id = current_id;
  end if;

  insert into public.pet_grooming_profiles (
    business_id, pet_id, coat_type, coat_condition, sensitivity_level,
    sensitivity_details, preferred_length, style_notes, handling_constraints,
    preferred_groomer, nail_service, ear_cleaning, teeth_brushing, information_source
  ) values (
    target_business_id, target_pet_id, coat_type_value, coat_condition_value, sensitivity_value,
    nullif(trim(sensitivity_text), ''), nullif(trim(preferred_length_text), ''),
    nullif(trim(style_note_text), ''), nullif(trim(handling_constraint_text), ''),
    nullif(trim(preferred_groomer_text), ''), nail_service_value,
    include_ear_cleaning, include_teeth_brushing, source_type
  ) returning id into created_id;
  return created_id;
end;
$$;

alter table public.pet_grooming_profiles enable row level security;
alter table public.pet_grooming_profiles force row level security;
create policy pet_grooming_profiles_select on public.pet_grooming_profiles for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_grooming_profiles_manage on public.pet_grooming_profiles for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_grooming_profiles from anon, authenticated;
grant select on public.pet_grooming_profiles to authenticated;
revoke all on function app.replace_pet_grooming_profile(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text) from public;
grant execute on function app.replace_pet_grooming_profile(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text) to authenticated;
