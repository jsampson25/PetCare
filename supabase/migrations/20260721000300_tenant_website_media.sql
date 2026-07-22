-- Governed public media library for tenant websites.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-website-media',
  'tenant-website-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.tenant_website_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  object_path text not null,
  original_file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  alt_text text not null check (char_length(trim(alt_text)) between 3 and 240),
  caption text,
  category text not null default 'general' check (category in ('general', 'pets', 'family', 'staff', 'facility', 'grooming', 'brand')),
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, object_path),
  check (object_path like business_id::text || '/%')
);

create index tenant_website_media_business_created_idx
  on public.tenant_website_media (business_id, created_at desc);

create trigger tenant_website_media_tenant before update on public.tenant_website_media
for each row execute function app.prevent_business_id_change();

create trigger tenant_website_media_audit after insert or update or delete on public.tenant_website_media
for each row execute function app.audit_configuration_change('website.media.changed', 'tenant_website_media');

create or replace function app.record_tenant_website_media(
  target_business_id uuid,
  object_path_value text,
  original_file_name_value text,
  mime_type_value text,
  byte_size_value bigint,
  alt_text_value text,
  caption_value text,
  category_value text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'website.edit')
    or object_path_value not like target_business_id::text || '/%'
    or mime_type_value not in ('image/jpeg', 'image/png', 'image/webp')
    or byte_size_value not between 1 and 10485760
    or char_length(trim(coalesce(alt_text_value, ''))) not between 3 and 240
    or category_value not in ('general', 'pets', 'family', 'staff', 'facility', 'grooming', 'brand') then
    raise exception 'valid website media required' using errcode = '22023';
  end if;

  insert into public.tenant_website_media (
    business_id, object_path, original_file_name, mime_type, byte_size, alt_text, caption, category
  ) values (
    target_business_id,
    object_path_value,
    left(trim(original_file_name_value), 255),
    mime_type_value,
    byte_size_value,
    trim(alt_text_value),
    nullif(left(trim(coalesce(caption_value, '')), 500), ''),
    category_value
  ) returning id into created_id;
  return created_id;
end;
$$;

alter table public.tenant_website_media enable row level security;
alter table public.tenant_website_media force row level security;
revoke all on public.tenant_website_media from anon, authenticated;
grant select on public.tenant_website_media to authenticated;
create policy tenant_website_media_staff on public.tenant_website_media
for select to authenticated using (app.member_has_permission(business_id, 'website.edit'));

create policy tenant_website_media_objects_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'tenant-website-media'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'website.edit')
);

create policy tenant_website_media_objects_update on storage.objects
for update to authenticated using (
  bucket_id = 'tenant-website-media'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'website.edit')
) with check (
  bucket_id = 'tenant-website-media'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'website.edit')
);

create policy tenant_website_media_objects_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'tenant-website-media'
  and app.member_has_permission(((storage.foldername(name))[1])::uuid, 'website.edit')
);

revoke all on function app.record_tenant_website_media(uuid, text, text, text, bigint, text, text, text) from public;
grant execute on function app.record_tenant_website_media(uuid, text, text, text, bigint, text, text, text) to authenticated;
