-- PetCare E04 private pet profile photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-profile-photos', 'pet-profile-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.pets
  add column photo_object_path text,
  add column photo_file_name text,
  add column photo_mime_type text,
  add column photo_updated_at timestamptz,
  add constraint pets_photo_metadata_complete check (
    (photo_object_path is null and photo_file_name is null and photo_mime_type is null and photo_updated_at is null)
    or (
      char_length(trim(coalesce(photo_object_path, ''))) > 0
      and char_length(trim(coalesce(photo_file_name, ''))) > 0
      and photo_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and photo_updated_at is not null
    )
  );

create or replace function app.replace_pet_profile_photo(
  target_business_id uuid,
  target_pet_id uuid,
  object_path text,
  original_file_name text,
  mime_type text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare previous_path text;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'pet photo management unavailable' using errcode = '42501';
  end if;
  if object_path !~ ('^' || target_business_id::text || '/' || target_pet_id::text || '/[0-9a-f-]+\.(jpg|png|webp)$')
    or char_length(trim(coalesce(original_file_name, ''))) < 1
    or mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid pet photo' using errcode = '22023';
  end if;

  select photo_object_path into previous_path
  from public.pets
  where business_id = target_business_id and id = target_pet_id
  for update;
  if not found then raise exception 'pet unavailable' using errcode = 'P0002'; end if;

  update public.pets set
    photo_object_path = object_path,
    photo_file_name = trim(original_file_name),
    photo_mime_type = mime_type,
    photo_updated_at = now()
  where business_id = target_business_id and id = target_pet_id;
  return previous_path;
end;
$$;

create policy pet_profile_photo_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'pet-profile-photos'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'pets.view')
  and exists (
    select 1 from public.pets
    where business_id = ((storage.foldername(name))[1])::uuid
      and id = ((storage.foldername(name))[2])::uuid
  )
);
create policy pet_profile_photo_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'pet-profile-photos'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'pets.manage_care')
  and exists (
    select 1 from public.pets
    where business_id = ((storage.foldername(name))[1])::uuid
      and id = ((storage.foldername(name))[2])::uuid
  )
);
create policy pet_profile_photo_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-profile-photos'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'pets.manage_care')
);

revoke all on function app.replace_pet_profile_photo(uuid, uuid, text, text, text) from public;
grant execute on function app.replace_pet_profile_photo(uuid, uuid, text, text, text) to authenticated;
