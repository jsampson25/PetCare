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
  '5c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'identifier-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Identifier Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '5c000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'identifier-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Identifier Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5c000000-0000-4000-8000-000000000001","role":"authenticated","email":"identifier-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Identifier Test', 'identifier-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'identifier-test'),
    'Casey', 'Owner', '', 'casey-identifier@example.test', null,
    'Scout', 'Mixed Breed', null, false, 'unknown'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.add_pet_identifier(
    (select id from public.businesses where public_slug = 'identifier-test'),
    (select id from public.pets where name = 'Scout'), 'microchip', '---', null, null, null
  ) $$,
  '22023', 'invalid pet identifier', 'identifier requires searchable characters'
);
select lives_ok(
  $$ select app.add_pet_identifier(
    (select id from public.businesses where public_slug = 'identifier-test'),
    (select id from public.pets where name = 'Scout'),
    'microchip', '985-141-000-123-456', 'PetLink', '2025-01-01', null
  ) $$,
  'owner adds microchip'
);
select is((select normalized_value from public.pet_identifiers), '985141000123456', 'identifier is normalized for lookup');
select throws_ok(
  $$ select app.add_pet_identifier(
    (select id from public.businesses where public_slug = 'identifier-test'),
    (select id from public.pets where name = 'Scout'),
    'microchip', '985 141 000 123 456', 'Other', null, null
  ) $$,
  '23505', 'identifier already assigned', 'formatting cannot bypass duplicate protection'
);
select lives_ok(
  $$ select app.retire_pet_identifier(
    (select business_id from public.pet_identifiers), (select id from public.pet_identifiers),
    'Microchip replaced after migration failure'
  ) $$,
  'identifier retires with history'
);

select set_config('request.jwt.claims', '{"sub":"5c000000-0000-4000-8000-000000000002","role":"authenticated","email":"identifier-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.retire_pet_identifier(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Hidden'
  ) $$,
  '42501', 'identifier management unavailable', 'unrelated identity cannot retire identifiers'
);

select * from finish();
rollback;
