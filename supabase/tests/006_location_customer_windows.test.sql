begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '52000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'window-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Window Owner"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52000000-0000-4000-8000-000000000001","role":"authenticated","email":"window-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Window Paws', 'window-paws', 'Main Facility', 'main', 'America/Chicago'
  ) $$,
  'owner creates a tenant for window configuration'
);

select lives_ok(
  $$ select app.save_business_onboarding_foundation(
    (select id from public.businesses where public_slug = 'window-paws'),
    (select id from public.locations where public_slug = 'main'),
    'Window Paws LLC', 'hello@windowpaws.example.test', '+1 555 010 0300',
    'US', 'en-US', 'USD', 'America/Chicago',
    '200 Main Street', '', 'Nashville', 'TN', '37201', '07:00'::time, '19:00'::time
  ) $$,
  'owner establishes operating hours before customer windows'
);

select lives_ok(
  $$ select app.save_location_customer_windows(
    (select id from public.businesses where public_slug = 'window-paws'),
    (select id from public.locations where public_slug = 'main'),
    '07:00'::time, '10:00'::time, '16:00'::time, '19:00'::time
  ) $$,
  'owner saves weekday arrival and pickup windows'
);

select is(
  (select count(*)::integer from public.location_customer_windows),
  14,
  'seven days are stored for each window type'
);

select throws_ok(
  $$ select app.save_location_customer_windows(
    (select id from public.businesses where public_slug = 'window-paws'),
    (select id from public.locations where public_slug = 'main'),
    '06:00'::time, '10:00'::time, '16:00'::time, '19:00'::time
  ) $$,
  '22023',
  'customer windows must fit operating hours',
  'customer windows cannot extend outside operating hours'
);

select * from finish();
rollback;
