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
  '51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'onboarding-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Onboarding Owner"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","email":"onboarding-owner@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Ready Paws', 'ready-paws', 'Main Facility', 'main', 'America/Chicago'
  ) $$,
  'owner creates the onboarding tenant and first location'
);

select is(
  (select completion_percent from app.get_business_setup_readiness((select id from public.businesses where public_slug = 'ready-paws'))),
  0,
  'new tenant begins with no completed profile steps'
);

select lives_ok(
  $$ select app.save_business_onboarding_foundation(
    (select id from public.businesses where public_slug = 'ready-paws'),
    (select id from public.locations where public_slug = 'main'),
    'Ready Paws LLC', 'hello@readypaws.example.test', '+1 555 010 0200',
    'US', 'en-US', 'USD', 'America/Chicago',
    '100 Main Street', '', 'Nashville', 'TN', '37201', '07:00'::time, '19:00'::time
  ) $$,
  'owner atomically saves business, location, and seven-day hours'
);

select ok(
  (select business_profile_complete from app.get_business_setup_readiness((select id from public.businesses where public_slug = 'ready-paws'))),
  'business profile becomes ready'
);
select ok(
  (select location_profile_complete from app.get_business_setup_readiness((select id from public.businesses where public_slug = 'ready-paws'))),
  'location profile becomes ready'
);
select ok(
  (select operating_hours_complete from app.get_business_setup_readiness((select id from public.businesses where public_slug = 'ready-paws'))),
  'operating hours become ready'
);
select is(
  (select completion_percent from app.get_business_setup_readiness((select id from public.businesses where public_slug = 'ready-paws'))),
  100,
  'completed foundation reports one hundred percent readiness for this slice'
);
select is(
  (select count(*)::integer from public.audit_events
   where event_type in ('business.profile_updated', 'location.profile_updated', 'location.hours_changed')),
  9,
  'profile and seven daily-hour changes create audit evidence'
);

select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","email":"onboarding-owner@example.test","aal":"aal1"}', true);
select is(
  (select completion_percent from app.get_business_setup_readiness((select id from public.businesses where public_slug = 'ready-paws'))),
  0,
  'AAL1 privileged session cannot infer saved readiness'
);

select * from finish();
rollback;
