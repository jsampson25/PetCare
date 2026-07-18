begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '5d000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'photo-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Photo Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '5d000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'photo-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Photo Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5d000000-0000-4000-8000-000000000001","role":"authenticated","email":"photo-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Photo Test', 'photo-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'photo-test'),
    'Jordan', 'Owner', '', 'jordan-photo@example.test', null,
    'Milo', 'Terrier Mix', null, false, 'male'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.replace_pet_profile_photo(
    (select id from public.businesses where public_slug = 'photo-test'),
    (select id from public.pets where name = 'Milo'), 'wrong/path.jpg', 'milo.jpg', 'image/jpeg'
  ) $$,
  '22023', 'invalid pet photo', 'photo path must be tenant and pet scoped'
);
select lives_ok(
  $$ select app.replace_pet_profile_photo(
    b.id, p.id, b.id::text || '/' || p.id::text || '/11111111-1111-4111-8111-111111111111.jpg',
    'milo.jpg', 'image/jpeg'
  ) from public.businesses b join public.pets p on p.business_id = b.id where b.public_slug = 'photo-test' $$,
  'owner records first photo'
);
select is((select photo_file_name from public.pets where name = 'Milo'), 'milo.jpg', 'photo metadata is retained');
select is(
  (select app.replace_pet_profile_photo(
    b.id, p.id, b.id::text || '/' || p.id::text || '/22222222-2222-4222-8222-222222222222.webp',
    'milo-new.webp', 'image/webp'
  ) from public.businesses b join public.pets p on p.business_id = b.id where b.public_slug = 'photo-test'),
  (select b.id::text || '/' || p.id::text || '/11111111-1111-4111-8111-111111111111.jpg'
   from public.businesses b join public.pets p on p.business_id = b.id where b.public_slug = 'photo-test'),
  'replacement returns prior object for cleanup'
);
select is((select photo_mime_type from public.pets where name = 'Milo'), 'image/webp', 'replacement metadata is current');

select set_config('request.jwt.claims', '{"sub":"5d000000-0000-4000-8000-000000000002","role":"authenticated","email":"photo-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.replace_pet_profile_photo(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002/33333333-3333-4333-8333-333333333333.jpg',
    'hidden.jpg', 'image/jpeg'
  ) $$,
  '42501', 'pet photo management unavailable', 'unrelated identity cannot replace a photo'
);

select * from finish();
rollback;
