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
  '53000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'closure-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Closure Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '53000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'unrelated-user@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Unrelated User"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"53000000-0000-4000-8000-000000000001","role":"authenticated","email":"closure-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Closure Paws', 'closure-paws', 'Main Facility', 'main', 'America/Chicago'
  ) $$,
  'owner creates a tenant for closure configuration'
);

select lives_ok(
  $$ select app.save_location_closure(
    (select id from public.businesses where public_slug = 'closure-paws'),
    (select id from public.locations where public_slug = 'main'),
    current_date + 30,
    'Facility maintenance',
    'We will reopen the following morning.'
  ) $$,
  'owner saves an upcoming closure'
);

select is(
  (select reason from public.location_closures),
  'Facility maintenance',
  'closure reason is stored'
);

select throws_ok(
  $$ select app.save_location_closure(
    (select id from public.businesses where public_slug = 'closure-paws'),
    (select id from public.locations where public_slug = 'main'),
    current_date - 1,
    'Past closure',
    ''
  ) $$,
  '22023',
  'invalid closure',
  'past closures cannot be added during onboarding'
);

select set_config('request.jwt.claims', '{"sub":"53000000-0000-4000-8000-000000000002","role":"authenticated","email":"unrelated-user@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.delete_location_closure(
    (select id from public.businesses where public_slug = 'closure-paws'),
    (select id from public.location_closures limit 1)
  ) $$,
  '42501',
  'closure unavailable',
  'an unrelated identity cannot delete the closure'
);

select set_config('request.jwt.claims', '{"sub":"53000000-0000-4000-8000-000000000001","role":"authenticated","email":"closure-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select app.delete_location_closure(
    (select id from public.businesses where public_slug = 'closure-paws'),
    (select id from public.location_closures limit 1)
  ) $$,
  'owner removes an upcoming closure'
);

select * from finish();
rollback;
