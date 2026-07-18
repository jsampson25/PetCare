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
  '59000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'feeding-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Feeding Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '59000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'feeding-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Feeding Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"59000000-0000-4000-8000-000000000001","role":"authenticated","email":"feeding-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Feeding Care', 'feeding-care', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'feeding-care'),
    'Casey', 'Nguyen', '', 'casey@example.test', '+1 555 010 0900',
    'Hazel', 'Retriever Mix', null, true, 'female'
  ) $$,
  'owner creates pet'
);
select throws_ok(
  $$ select app.add_pet_feeding_plan(
    (select id from public.businesses where public_slug = 'feeding-care'),
    (select id from public.pets where name = 'Hazel'),
    'Sensitive stomach kibble', 'customer_provided', '1 cup', 2, '8 AM and 5 PM',
    'Add warm water', '', true, '', 'customer_reported'
  ) $$,
  '22023', 'invalid feeding plan', 'separate feeding requires a safety reason'
);
select lives_ok(
  $$ select app.add_pet_feeding_plan(
    (select id from public.businesses where public_slug = 'feeding-care'),
    (select id from public.pets where name = 'Hazel'),
    'Sensitive stomach kibble', 'customer_provided', '1 cup', 2, '8 AM and 5 PM',
    'Add warm water and wait five minutes', 'One probiotic at breakfast', true,
    'Guards food from other dogs', 'customer_reported'
  ) $$,
  'owner adds complete feeding plan'
);
select is((select meals_per_day::integer from public.pet_feeding_plans), 2, 'meal count remains structured');
select throws_ok(
  $$ select app.add_pet_feeding_plan(
    (select business_id from public.pet_feeding_plans), (select pet_id from public.pet_feeding_plans),
    'Other', 'business_provided', '1 cup', 1, 'Noon', 'Serve dry', '', false, '', 'staff_confirmed'
  ) $$,
  '23505', 'active feeding plan already exists', 'only one active plan is allowed'
);
select lives_ok(
  $$ select app.discontinue_pet_feeding_plan(
    (select business_id from public.pet_feeding_plans), (select id from public.pet_feeding_plans),
    'Customer supplied a replacement diet plan.'
  ) $$,
  'authorized staff discontinues plan with history'
);

select set_config('request.jwt.claims', '{"sub":"59000000-0000-4000-8000-000000000002","role":"authenticated","email":"feeding-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_feeding_plan(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'Hidden', 'customer_provided', '1 cup', 1, 'Noon', 'Hidden', '', false, '', 'customer_reported'
  ) $$,
  '42501', 'feeding management unavailable', 'unrelated identity cannot add feeding data'
);

select * from finish();
rollback;
