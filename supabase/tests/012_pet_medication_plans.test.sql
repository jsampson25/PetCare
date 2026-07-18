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
  '58000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'med-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Medication Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '58000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'med-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Medication Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"58000000-0000-4000-8000-000000000001","role":"authenticated","email":"med-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Medication Care', 'medication-care', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'medication-care'),
    'Jordan', 'Lee', '', 'jordan@example.test', '+1 555 010 0800',
    'Winston', 'Bulldog', null, true, 'male'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.add_pet_medication_plan(
    (select id from public.businesses where public_slug = 'medication-care'),
    (select id from public.pets where name = 'Winston'),
    'Diphenhydramine', '25 mg', 'oral', 'As needed', 'Give with food', true, '', null, null, 'customer_reported'
  ) $$,
  '22023', 'invalid medication plan', 'as-needed medication requires an indication'
);
select lives_ok(
  $$ select app.add_pet_medication_plan(
    (select id from public.businesses where public_slug = 'medication-care'),
    (select id from public.pets where name = 'Winston'),
    'Diphenhydramine', '25 mg', 'oral', 'As needed, no more than every 8 hours',
    'Give with food and record response', true, 'Hives after approved allergen exposure',
    '2026-01-01', null, 'veterinary_documented'
  ) $$,
  'owner adds complete medication plan'
);
select is((select dose from public.pet_medication_plans), '25 mg', 'dose remains explicit');
select throws_ok(
  $$ select app.discontinue_pet_medication_plan(
    (select business_id from public.pet_medication_plans), (select id from public.pet_medication_plans), ''
  ) $$,
  '22023', 'discontinuation reason required', 'discontinuation requires context'
);
select lives_ok(
  $$ select app.discontinue_pet_medication_plan(
    (select business_id from public.pet_medication_plans), (select id from public.pet_medication_plans),
    'Veterinarian discontinued medication.'
  ) $$,
  'authorized staff discontinues plan with history'
);

select set_config('request.jwt.claims', '{"sub":"58000000-0000-4000-8000-000000000002","role":"authenticated","email":"med-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_medication_plan(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'Hidden', '1 tablet', 'oral', 'Daily', 'Hidden', false, '', null, null, 'customer_reported'
  ) $$,
  '42501', 'medication management unavailable', 'unrelated identity cannot add medication data'
);

select * from finish();
rollback;
