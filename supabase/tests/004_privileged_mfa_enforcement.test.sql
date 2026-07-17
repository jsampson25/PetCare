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
  '41000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'mfa-owner@example.test', '', now(), '{}'::jsonb, '{"display_name":"MFA Owner"}'::jsonb,
  now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated","email":"mfa-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner(
    'MFA Business', 'mfa-business', 'Main', 'main', 'America/Chicago'
  ) $$,
  'MFA enforcement fixture is provisioned'
);

select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated","email":"mfa-owner@example.test","aal":"aal1"}', true);

select is(
  app.member_has_permission(
    (select id from public.businesses where public_slug = 'mfa-business'),
    'business.manage_security'
  ),
  false,
  'an AAL1 owner session receives no privileged permission'
);

select is(
  (select count(*)::integer from public.locations),
  0,
  'an AAL1 privileged session receives no location data'
);

select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated","email":"mfa-owner@example.test","aal":"aal2"}', true);

select ok(
  app.member_has_permission(
    (select id from public.businesses where public_slug = 'mfa-business'),
    'business.manage_security'
  ),
  'the same owner permission activates after MFA verification'
);

select is(
  (select count(*)::integer from public.locations),
  1,
  'location access activates after MFA verification'
);

select * from finish();
rollback;
