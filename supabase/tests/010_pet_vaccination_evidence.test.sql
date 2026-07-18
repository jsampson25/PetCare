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
  '56000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'vaccine-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Vaccine Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '56000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'vaccine-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Vaccine Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"56000000-0000-4000-8000-000000000001","role":"authenticated","email":"vaccine-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner('Vaccine Care', 'vaccine-care', 'Main', 'main', 'America/Chicago') $$,
  'owner creates the tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'vaccine-care'),
    'Jamie', 'Rivera', '', 'jamie@example.test', '+1 555 010 0600',
    'Milo', 'Beagle Mix', null, true, 'male'
  ) $$,
  'owner creates a customer and dog'
);
select lives_ok(
  $$ select app.submit_pet_vaccination(
    (select id from public.businesses where public_slug = 'vaccine-care'),
    (select id from public.pets where name = 'Milo'),
    'rabies', '2026-01-10', '2027-01-10', 'River Vet',
    (select id::text from public.businesses where public_slug = 'vaccine-care') || '/' ||
      (select id::text from public.pets where name = 'Milo') || '/rabies.pdf',
    'rabies.pdf', 'application/pdf'
  ) $$,
  'owner submits structured vaccine evidence'
);
select is((select review_status from public.pet_vaccinations), 'pending', 'new evidence awaits review');
select throws_ok(
  $$ select app.review_pet_vaccination(
    (select business_id from public.pet_vaccinations),
    (select id from public.pet_vaccinations), 'rejected', ''
  ) $$,
  '22023', 'invalid vaccination review', 'rejection requires a reason'
);
select throws_ok(
  $$ select app.review_pet_vaccination(
    (select business_id from public.pet_vaccinations),
    (select id from public.pet_vaccinations), 'accepted', ''
  ) $$,
  '55000', 'vaccination evidence scan incomplete', 'pending evidence cannot be accepted'
);
update public.pet_vaccinations set scan_status = 'clean';
select lives_ok(
  $$ select app.review_pet_vaccination(
    (select business_id from public.pet_vaccinations),
    (select id from public.pet_vaccinations), 'accepted', ''
  ) $$,
  'authorized staff accepts evidence'
);

select set_config('request.jwt.claims', '{"sub":"56000000-0000-4000-8000-000000000002","role":"authenticated","email":"vaccine-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.submit_pet_vaccination(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'rabies', null, '2027-01-10', '',
    '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002/x.pdf',
    'x.pdf', 'application/pdf'
  ) $$,
  '42501', 'vaccination submission unavailable', 'unrelated identity cannot submit evidence'
);

select * from finish();
rollback;
