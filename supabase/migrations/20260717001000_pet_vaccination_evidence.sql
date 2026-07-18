-- PetCare E04 vaccination evidence and staff review.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-vaccine-evidence',
  'pet-vaccine-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.pet_vaccinations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  vaccine_type text not null check (vaccine_type in (
    'rabies', 'dhpp', 'bordetella', 'canine_influenza', 'leptospirosis', 'other'
  )),
  administered_on date,
  expires_on date not null,
  provider_name text check (provider_name is null or char_length(trim(provider_name)) between 1 and 160),
  evidence_object_path text not null,
  evidence_file_name text not null check (char_length(trim(evidence_file_name)) between 1 and 255),
  evidence_mime_type text not null check (evidence_mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'blocked')),
  review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'rejected', 'expired', 'superseded', 'waived')),
  review_reason text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (evidence_object_path),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (administered_on is null or administered_on <= expires_on),
  check (expires_on >= created_at::date - interval '20 years'),
  check ((reviewed_at is null) = (reviewed_by is null)),
  check (review_status <> 'rejected' or char_length(trim(coalesce(review_reason, ''))) > 0)
);

create index pet_vaccinations_pet_idx
on public.pet_vaccinations (business_id, pet_id, vaccine_type, expires_on desc);

create trigger pet_vaccinations_set_updated_at before update on public.pet_vaccinations
for each row execute function app.set_updated_at();
create trigger pet_vaccinations_prevent_business_change before update on public.pet_vaccinations
for each row execute function app.prevent_business_id_change();
create trigger pet_vaccinations_audit after insert or update or delete on public.pet_vaccinations
for each row execute function app.audit_configuration_change('pet.vaccination.changed', 'pet_vaccination');

create or replace function app.submit_pet_vaccination(
  target_business_id uuid,
  target_pet_id uuid,
  vaccination_type text,
  administered_date date,
  expiration_date date,
  provider text,
  object_path text,
  original_file_name text,
  mime_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'vaccination submission unavailable' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pets where business_id = target_business_id and id = target_pet_id
  ) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if vaccination_type not in ('rabies', 'dhpp', 'bordetella', 'canine_influenza', 'leptospirosis', 'other')
    or expiration_date is null
    or (administered_date is not null and administered_date > expiration_date)
    or mime_type not in ('application/pdf', 'image/jpeg', 'image/png')
    or object_path not like target_business_id::text || '/' || target_pet_id::text || '/%'
    or char_length(trim(coalesce(original_file_name, ''))) < 1 then
    raise exception 'invalid vaccination evidence' using errcode = '22023';
  end if;

  insert into public.pet_vaccinations (
    business_id, pet_id, vaccine_type, administered_on, expires_on, provider_name,
    evidence_object_path, evidence_file_name, evidence_mime_type
  ) values (
    target_business_id, target_pet_id, vaccination_type, administered_date, expiration_date,
    nullif(trim(provider), ''), object_path, trim(original_file_name), mime_type
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function app.review_pet_vaccination(
  target_business_id uuid,
  vaccination_id uuid,
  decision text,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'vaccination review unavailable' using errcode = '42501';
  end if;
  if decision not in ('accepted', 'rejected')
    or (decision = 'rejected' and char_length(trim(coalesce(reason, ''))) < 1) then
    raise exception 'invalid vaccination review' using errcode = '22023';
  end if;
  if decision = 'accepted' and not exists (
    select 1 from public.pet_vaccinations
    where business_id = target_business_id and id = vaccination_id and scan_status = 'clean'
  ) then
    raise exception 'vaccination evidence scan incomplete' using errcode = '55000';
  end if;

  update public.pet_vaccinations set
    review_status = decision,
    review_reason = nullif(trim(reason), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where business_id = target_business_id
    and id = vaccination_id
    and review_status = 'pending';
  if not found then raise exception 'vaccination unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_vaccinations enable row level security;
alter table public.pet_vaccinations force row level security;
create policy pet_vaccinations_select on public.pet_vaccinations for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_vaccinations_manage on public.pet_vaccinations for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

create policy pet_vaccine_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'pet-vaccine-evidence'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'pets.view')
  and exists (
    select 1 from public.pets
    where business_id = ((storage.foldername(name))[1])::uuid
      and id = ((storage.foldername(name))[2])::uuid
  )
);
create policy pet_vaccine_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'pet-vaccine-evidence'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'pets.manage_care')
  and exists (
    select 1 from public.pets
    where business_id = ((storage.foldername(name))[1])::uuid
      and id = ((storage.foldername(name))[2])::uuid
  )
);
create policy pet_vaccine_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-vaccine-evidence'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'pets.manage_care')
);

revoke all on public.pet_vaccinations from anon, authenticated;
grant select, insert, update on public.pet_vaccinations to authenticated;
revoke all on function app.submit_pet_vaccination(uuid, uuid, text, date, date, text, text, text, text) from public;
grant execute on function app.submit_pet_vaccination(uuid, uuid, text, date, date, text, text, text, text) to authenticated;
revoke all on function app.review_pet_vaccination(uuid, uuid, text, text) from public;
grant execute on function app.review_pet_vaccination(uuid, uuid, text, text) to authenticated;
