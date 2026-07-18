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
  '5b000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'health-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Health Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '5b000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'health-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Health Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5b000000-0000-4000-8000-000000000001","role":"authenticated","email":"health-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Health Care', 'health-care', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'health-care'),
    'Avery', 'Patel', '', 'avery@example.test', '+1 555 010 1100',
    'Finn', 'Spaniel Mix', null, true, 'male'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.add_pet_health_condition(
    (select id from public.businesses where public_slug = 'health-care'),
    (select id from public.pets where name = 'Finn'),
    'Epilepsy', 'seizure', 'critical', '2024-02-01', 'Monitor for seizure activity.', '', 'veterinary_documented'
  ) $$,
  '22023', 'invalid health condition', 'critical condition requires emergency instructions'
);
select lives_ok(
  $$ select app.add_pet_health_condition(
    (select id from public.businesses where public_slug = 'health-care'),
    (select id from public.pets where name = 'Finn'),
    'Epilepsy', 'seizure', 'critical', '2024-02-01',
    'Avoid flashing lights and record all seizure activity.',
    'Time seizure, protect from injury, and call emergency veterinarian after five minutes.',
    'veterinary_documented'
  ) $$,
  'owner adds complete critical health condition'
);
select is((select severity from public.pet_health_conditions), 'critical', 'critical severity remains structured');
select throws_ok(
  $$ select app.resolve_pet_health_condition(
    (select business_id from public.pet_health_conditions), (select id from public.pet_health_conditions), ''
  ) $$,
  '22023', 'resolution reason required', 'resolution requires medical context'
);
select lives_ok(
  $$ select app.resolve_pet_health_condition(
    (select business_id from public.pet_health_conditions), (select id from public.pet_health_conditions),
    'Veterinarian corrected the diagnosis; supporting history retained.'
  ) $$,
  'authorized staff resolves condition with history'
);

select set_config('request.jwt.claims', '{"sub":"5b000000-0000-4000-8000-000000000002","role":"authenticated","email":"health-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_health_condition(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'Hidden', 'other', 'mild', null, 'Hidden', '', 'customer_reported'
  ) $$,
  '42501', 'health management unavailable', 'unrelated identity cannot add health data'
);

select * from finish();
rollback;
