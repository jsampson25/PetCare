-- PetCare E04 structured primary and emergency veterinary contacts.

create table public.pet_veterinary_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  clinic_name text not null check (char_length(trim(clinic_name)) between 1 and 200),
  veterinarian_name text,
  phone text not null check (char_length(trim(phone)) between 7 and 40),
  email text,
  address text,
  is_primary boolean not null default false,
  is_emergency boolean not null default false,
  information_source text not null check (information_source in ('customer_reported', 'staff_confirmed', 'veterinary_documented')),
  notes text,
  status text not null default 'active' check (status in ('active', 'retired')),
  retired_reason text,
  retired_by uuid references auth.users (id) on delete set null,
  retired_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (is_primary or is_emergency),
  check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check ((retired_at is null) = (retired_by is null)),
  check (status <> 'retired' or char_length(trim(coalesce(retired_reason, ''))) > 0)
);

create unique index pet_veterinary_contacts_one_primary_idx
on public.pet_veterinary_contacts (business_id, pet_id)
where status = 'active' and is_primary;
create unique index pet_veterinary_contacts_one_emergency_idx
on public.pet_veterinary_contacts (business_id, pet_id)
where status = 'active' and is_emergency;
create index pet_veterinary_contacts_pet_idx
on public.pet_veterinary_contacts (business_id, pet_id, status, created_at desc);

create trigger pet_veterinary_contacts_set_updated_at before update on public.pet_veterinary_contacts
for each row execute function app.set_updated_at();
create trigger pet_veterinary_contacts_prevent_business_change before update on public.pet_veterinary_contacts
for each row execute function app.prevent_business_id_change();
create trigger pet_veterinary_contacts_audit after insert or update or delete on public.pet_veterinary_contacts
for each row execute function app.audit_configuration_change('pet.veterinary_contact.changed', 'pet_veterinary_contact');

create or replace function app.add_pet_veterinary_contact(
  target_business_id uuid,
  target_pet_id uuid,
  clinic text,
  veterinarian text,
  phone_number text,
  email_address text,
  street_address text,
  primary_contact boolean,
  emergency_contact boolean,
  source_type text,
  note_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'veterinary contact management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(clinic, ''))) < 1
    or char_length(trim(coalesce(phone_number, ''))) < 7
    or not (primary_contact or emergency_contact)
    or source_type not in ('customer_reported', 'staff_confirmed', 'veterinary_documented')
    or (nullif(trim(email_address), '') is not null and trim(email_address) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'invalid veterinary contact' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;

  insert into public.pet_veterinary_contacts (
    business_id, pet_id, clinic_name, veterinarian_name, phone, email, address,
    is_primary, is_emergency, information_source, notes
  ) values (
    target_business_id, target_pet_id, trim(clinic), nullif(trim(veterinarian), ''),
    trim(phone_number), nullif(lower(trim(email_address)), ''), nullif(trim(street_address), ''),
    primary_contact, emergency_contact, source_type, nullif(trim(note_text), '')
  ) returning id into created_id;
  return created_id;
exception when unique_violation then
  raise exception 'active veterinary role already assigned' using errcode = '23505';
end;
$$;

create or replace function app.retire_pet_veterinary_contact(
  target_business_id uuid,
  veterinary_contact_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'veterinary contact management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 1 then
    raise exception 'retirement reason required' using errcode = '22023';
  end if;
  update public.pet_veterinary_contacts set
    status = 'retired', retired_reason = trim(reason),
    retired_by = auth.uid(), retired_at = now()
  where business_id = target_business_id and id = veterinary_contact_id and status = 'active';
  if not found then raise exception 'veterinary contact unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_veterinary_contacts enable row level security;
alter table public.pet_veterinary_contacts force row level security;
create policy pet_veterinary_contacts_select on public.pet_veterinary_contacts for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_veterinary_contacts_manage on public.pet_veterinary_contacts for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_veterinary_contacts from anon, authenticated;
grant select on public.pet_veterinary_contacts to authenticated;
revoke all on function app.add_pet_veterinary_contact(uuid, uuid, text, text, text, text, text, boolean, boolean, text, text) from public;
grant execute on function app.add_pet_veterinary_contact(uuid, uuid, text, text, text, text, text, boolean, boolean, text, text) to authenticated;
revoke all on function app.retire_pet_veterinary_contact(uuid, uuid, text) from public;
grant execute on function app.retire_pet_veterinary_contact(uuid, uuid, text) to authenticated;
