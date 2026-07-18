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
  '5a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'behavior-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Behavior Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '5a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'behavior-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Behavior Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-4000-8000-000000000001","role":"authenticated","email":"behavior-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Behavior Care', 'behavior-care', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'behavior-care'),
    'Morgan', 'Diaz', '', 'morgan@example.test', '+1 555 010 1000',
    'Ranger', 'Shepherd Mix', null, true, 'male'
  ) $$,
  'owner creates pet'
);
select lives_ok(
  $$ select app.add_pet_behavior_record(
    (select id from public.businesses where public_slug = 'behavior-care'),
    (select id from public.pets where name = 'Ranger'),
    'escape_risk', 'critical', 'Climbed a six-foot chain-link fence at prior facility.',
    '2026-06-01', 'Outdoor yards with climbable fencing',
    'Use covered yard with leash transfer and two-door check.', 'Never leave unattended outdoors.',
    'Responds to quiet voice and food reward.', 'conditional', 'customer_reported'
  ) $$,
  'owner adds structured escape-risk record'
);
select is((select severity from public.pet_behavior_records), 'critical', 'critical risk remains structured');
select throws_ok(
  $$ select app.resolve_pet_behavior_record(
    (select business_id from public.pet_behavior_records), (select id from public.pet_behavior_records), ''
  ) $$,
  '22023', 'resolution reason required', 'resolution requires safety context'
);
select lives_ok(
  $$ select app.resolve_pet_behavior_record(
    (select business_id from public.pet_behavior_records), (select id from public.pet_behavior_records),
    'New professional evaluation supersedes this record; prior history retained.'
  ) $$,
  'authorized staff resolves record with history'
);

select set_config('request.jwt.claims', '{"sub":"5a000000-0000-4000-8000-000000000002","role":"authenticated","email":"behavior-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.add_pet_behavior_record(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'other', 'information', 'Hidden', null, '', 'Hidden', '', '', 'not_evaluated', 'customer_reported'
  ) $$,
  '42501', 'behavior management unavailable', 'unrelated identity cannot add behavior data'
);

select * from finish();
rollback;
