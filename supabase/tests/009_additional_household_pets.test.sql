begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '55000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'additional-pet-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Additional Pet Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '55000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'additional-pet-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Additional Pet Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55000000-0000-4000-8000-000000000001","role":"authenticated","email":"additional-pet-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'More Pets', 'more-pets', 'Main Facility', 'main', 'America/Chicago'
  ) $$,
  'owner creates the tenant'
);

select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'more-pets'),
    'Alex', 'Morgan', '', 'alex@example.test', '+1 555 010 0500',
    'Scout', 'Labrador Mix', null, true, 'male'
  ) $$,
  'owner creates the initial household and dog'
);

select lives_ok(
  $$ select app.add_pet_to_customer_household(
    (select id from public.businesses where public_slug = 'more-pets'),
    (select id from public.customers where email = 'alex@example.test'),
    'Pepper', 'Terrier Mix', '2021-08-01'::date, false, 'female'
  ) $$,
  'owner adds another dog to the same household'
);

select is((select count(*)::integer from public.pets), 2, 'household now has two dogs');

select set_config('request.jwt.claims', '{"sub":"55000000-0000-4000-8000-000000000002","role":"authenticated","email":"additional-pet-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_to_customer_household(
    (select id from public.businesses where public_slug = 'more-pets'),
    (select id from public.customers where email = 'alex@example.test'),
    'Hidden', 'Unknown Mix', null, true, 'unknown'
  ) $$,
  '42501',
  'pet creation unavailable',
  'unrelated identity cannot add a pet'
);

select * from finish();
rollback;
