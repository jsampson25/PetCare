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
  '5e000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'evaluation-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Evaluation Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '5e000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'evaluation-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Evaluation Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5e000000-0000-4000-8000-000000000001","role":"authenticated","email":"evaluation-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Evaluation Test', 'evaluation-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select * from app.create_customer_household_with_pet(
    (select id from public.businesses where public_slug = 'evaluation-test'),
    'Morgan', 'Owner', '', 'morgan-evaluation@example.test', null,
    'Piper', 'Retriever Mix', null, false, 'female'
  ) $$,
  'owner creates pet'
);
select lives_ok(
  $$ select app.create_pet_service_evaluation(
    (select id from public.businesses where public_slug = 'evaluation-test'),
    (select id from public.pets where name = 'Piper'), 'daycare_group_play', current_date
  ) $$,
  'owner requests evaluation'
);
select throws_ok(
  $$ select app.create_pet_service_evaluation(
    (select id from public.businesses where public_slug = 'evaluation-test'),
    (select id from public.pets where name = 'Piper'), 'daycare_group_play', current_date
  ) $$,
  '23505', 'pending evaluation already exists', 'duplicate pending evaluation is blocked'
);
select throws_ok(
  $$ select app.transition_pet_service_evaluation(
    (select business_id from public.pet_service_evaluations), (select id from public.pet_service_evaluations),
    'conditional', 'Small-dog group only', '', current_date + 90
  ) $$,
  '22023', 'invalid evaluation transition', 'conditional approval requires explicit conditions'
);
select lives_ok(
  $$ select app.transition_pet_service_evaluation(
    (select business_id from public.pet_service_evaluations), (select id from public.pet_service_evaluations),
    'conditional', 'Calm participation observed', 'Small-dog group with supervised introductions', current_date + 90
  ) $$,
  'authorized evaluator records conditional approval'
);
select is((select status from public.pet_service_evaluations), 'conditional', 'conditional state is current');
select is((select count(*) from public.pet_service_evaluation_transitions), 2::bigint, 'transition history is retained');

select set_config('request.jwt.claims', '{"sub":"5e000000-0000-4000-8000-000000000002","role":"authenticated","email":"evaluation-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.transition_pet_service_evaluation(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'suspended', 'Hidden', '', null
  ) $$,
  '42501', 'evaluation management unavailable', 'unrelated identity cannot transition an evaluation'
);

select * from finish();
rollback;
