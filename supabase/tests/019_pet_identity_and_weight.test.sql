begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '5f000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'identity-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Identity Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '5f000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'identity-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Identity Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5f000000-0000-4000-8000-000000000001","role":"authenticated","email":"identity-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Identity Test', 'identity-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'identity-test'),
    'Taylor', 'Owner', '', 'taylor-identity@example.test', null,
    'Pepper', 'Mixed Breed', null, false, 'female'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.update_pet_identity(
    (select business_id from public.pets), (select id from public.pets),
    'Pepper', '', 'Mixed Breed', '', 'female', 'altered', null, true
  ) $$,
  '22023', 'invalid pet identity', 'missing birth date cannot be labeled estimated'
);
select lives_ok(
  $$ select app.update_pet_identity(
    (select business_id from public.pets), (select id from public.pets),
    'Pepper', 'Pep', 'Labrador / Poodle Mix', 'Black with white chest',
    'female', 'altered', '2022-06-01', true
  ) $$,
  'owner completes structured identity'
);
select is((select preferred_name from public.pets), 'Pep', 'preferred name is retained separately');
select throws_ok(
  $$ select app.add_pet_weight_record(
    (select business_id from public.pets), (select id from public.pets),
    0, 'lb', current_date, 'staff_measured', ''
  ) $$,
  '22023', 'invalid pet weight', 'zero weight is rejected'
);
select lives_ok(
  $$ select app.add_pet_weight_record(
    (select business_id from public.pets), (select id from public.pets),
    55, 'lb', current_date, 'staff_measured', 'Check-in scale'
  ) $$,
  'owner records measured weight'
);
select is((select weight_kg from public.pet_weight_records), 24.95::numeric, 'pounds are normalized to kilograms');
select is((select reported_unit from public.pet_weight_records), 'lb', 'original unit is retained');

select set_config('request.jwt.claims', '{"sub":"5f000000-0000-4000-8000-000000000002","role":"authenticated","email":"identity-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_weight_record(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    10, 'kg', current_date, 'staff_measured', 'Hidden'
  ) $$,
  '42501', 'pet weight management unavailable', 'unrelated identity cannot add weight'
);

select * from finish();
rollback;
