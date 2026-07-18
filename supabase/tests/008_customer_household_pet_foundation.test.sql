begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '54000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'customer-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Customer Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '54000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'unrelated-customer-user@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Unrelated User"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"54000000-0000-4000-8000-000000000001","role":"authenticated","email":"customer-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Customer Paws', 'customer-paws', 'Main Facility', 'main', 'America/Chicago'
  ) $$,
  'owner creates a tenant for customer records'
);

select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'customer-paws'),
    'Jordan', 'Sampson', 'Jordy', 'jordan@example.test', '+1 555 010 0400',
    'Bella', 'Golden Retriever', '2022-04-10'::date, false, 'female'
  ) $$,
  'staff atomically creates a customer, household, membership, and dog'
);

select is((select count(*)::integer from public.customers), 1, 'one customer is created');
select is((select count(*)::integer from public.household_members), 1, 'customer administers the household');
select is((select count(*)::integer from public.pets), 1, 'the first dog is linked to the household');

select set_config('request.jwt.claims', '{"sub":"54000000-0000-4000-8000-000000000002","role":"authenticated","email":"unrelated-customer-user@example.test","aal":"aal2"}', true);
select is((select count(*)::integer from public.customers), 0, 'unrelated identity cannot read tenant customers');

select * from finish();
rollback;
