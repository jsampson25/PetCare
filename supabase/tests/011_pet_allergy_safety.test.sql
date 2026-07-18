begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '57000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'allergy-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Allergy Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '57000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'allergy-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Allergy Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"57000000-0000-4000-8000-000000000001","role":"authenticated","email":"allergy-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Allergy Care', 'allergy-care', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'allergy-care'),
    'Taylor', 'Kim', '', 'taylor@example.test', '+1 555 010 0700',
    'Poppy', 'Poodle Mix', null, true, 'female'
  ) $$,
  'owner creates pet'
);
select lives_ok(
  $$ select app.add_pet_allergy(
    (select id from public.businesses where public_slug = 'allergy-care'),
    (select id from public.pets where name = 'Poppy'),
    'Peanuts', 'food', 'life_threatening', 'Facial swelling',
    'Avoid all peanut products and contact manager immediately after exposure.', 'veterinary_documented'
  ) $$,
  'owner adds structured allergy'
);
select is((select severity from public.pet_allergies), 'life_threatening', 'severity remains structured');
select throws_ok(
  $$ select app.resolve_pet_allergy(
    (select business_id from public.pet_allergies), (select id from public.pet_allergies), ''
  ) $$,
  '22023', 'resolution reason required', 'resolution cannot erase safety context'
);
select lives_ok(
  $$ select app.resolve_pet_allergy(
    (select business_id from public.pet_allergies), (select id from public.pet_allergies),
    'Veterinarian confirmed the original diagnosis was incorrect.'
  ) $$,
  'authorized staff resolves allergy with reason'
);

select set_config('request.jwt.claims', '{"sub":"57000000-0000-4000-8000-000000000002","role":"authenticated","email":"allergy-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_allergy(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'Hidden', 'other', 'mild', 'Hidden', 'Hidden', 'customer_reported'
  ) $$,
  '42501', 'allergy management unavailable', 'unrelated identity cannot add allergy data'
);

select * from finish();
rollback;
