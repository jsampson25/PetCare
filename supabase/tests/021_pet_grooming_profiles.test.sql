begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'grooming-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Grooming Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'grooming-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Grooming Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","email":"grooming-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Grooming Test', 'grooming-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'grooming-test'),
    'Jamie', 'Owner', '', 'jamie-grooming@example.test', null,
    'Teddy', 'Doodle Mix', null, false, 'male'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.replace_pet_grooming_profile(
    (select business_id from public.pets), (select id from public.pets),
    'curly', 'healthy', 'high', '', '', '', '', '', 'grind', false, false,
    'customer_reported', ''
  ) $$,
  '22023', 'invalid grooming profile', 'sensitivity requires structured detail'
);
select lives_ok(
  $$ select app.replace_pet_grooming_profile(
    (select business_id from public.pets), (select id from public.pets),
    'curly', 'healthy', 'moderate', 'Sensitive around front paws', 'One inch',
    'Rounded face', 'Use low-noise dryer', 'Alex', 'grind', true, true,
    'customer_reported', ''
  ) $$,
  'owner creates grooming profile'
);
select is((select preferred_groomer from public.pet_grooming_profiles), 'Alex', 'preferred groomer is retained as profile data');
select throws_ok(
  $$ select app.replace_pet_grooming_profile(
    (select business_id from public.pets), (select id from public.pets),
    'curly', 'healthy', 'low', 'Front paws improving', 'Half inch',
    'Shorter body', 'Use low-noise dryer', 'Alex', 'trim', true, false,
    'groomer_observed', ''
  ) $$,
  '22023', 'grooming profile change reason required', 'replacement requires change context'
);
select lives_ok(
  $$ select app.replace_pet_grooming_profile(
    (select business_id from public.pets), (select id from public.pets),
    'curly', 'healthy', 'low', 'Front paws improving', 'Half inch',
    'Shorter body', 'Use low-noise dryer', 'Alex', 'trim', true, false,
    'groomer_observed', 'Updated after completed groom'
  ) $$,
  'authorized groomer observation creates new version'
);
select is((select count(*) from public.pet_grooming_profiles), 2::bigint, 'prior grooming profile remains historical');
select is((select count(*) from public.pet_grooming_profiles where status = 'current'), 1::bigint, 'only one grooming profile is current');

select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","email":"grooming-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.replace_pet_grooming_profile(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'short', 'healthy', 'none', '', '', '', '', '', 'no_preference', false, false,
    'customer_reported', ''
  ) $$,
  '42501', 'grooming profile management unavailable', 'unrelated identity cannot replace grooming profile'
);

select * from finish();
rollback;
