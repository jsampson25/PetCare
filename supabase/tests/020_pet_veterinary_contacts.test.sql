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
  '60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'veterinary-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Veterinary Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'veterinary-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Veterinary Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","email":"veterinary-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Veterinary Test', 'veterinary-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'veterinary-test'),
    'Riley', 'Owner', '', 'riley-veterinary@example.test', null,
    'Winnie', 'Beagle Mix', null, false, 'female'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.add_pet_veterinary_contact(
    (select business_id from public.pets), (select id from public.pets),
    'Care Clinic', '', '555-0100', '', '', false, false, 'customer_reported', ''
  ) $$,
  '22023', 'invalid veterinary contact', 'contact requires a defined role'
);
select lives_ok(
  $$ select app.add_pet_veterinary_contact(
    (select business_id from public.pets), (select id from public.pets),
    'Care Clinic', 'Dr. Rivera', '555-010-2200', 'CARE@EXAMPLE.TEST', '1 Care Way',
    true, true, 'staff_confirmed', 'Twenty-four hour line'
  ) $$,
  'owner adds primary and emergency contact'
);
select is((select email from public.pet_veterinary_contacts), 'care@example.test', 'email is normalized');
select throws_ok(
  $$ select app.add_pet_veterinary_contact(
    (select business_id from public.pets), (select id from public.pets),
    'Other Clinic', '', '555-010-3300', '', '', true, false, 'customer_reported', ''
  ) $$,
  '23505', 'active veterinary role already assigned', 'duplicate active primary role is blocked'
);
select lives_ok(
  $$ select app.retire_pet_veterinary_contact(
    (select business_id from public.pet_veterinary_contacts),
    (select id from public.pet_veterinary_contacts), 'Customer changed providers'
  ) $$,
  'contact retires with history'
);
select is((select status from public.pet_veterinary_contacts), 'retired', 'retired contact remains historical');

select set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated","email":"veterinary-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.retire_pet_veterinary_contact(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Hidden'
  ) $$,
  '42501', 'veterinary contact management unavailable', 'unrelated identity cannot retire contact'
);

select * from finish();
rollback;
