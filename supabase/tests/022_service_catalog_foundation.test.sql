begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'catalog-owner@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Catalog Owner"}'::jsonb, now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'catalog-outsider@example.test', '', now(), '{}'::jsonb,
  '{"display_name":"Catalog Outsider"}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","email":"catalog-owner@example.test","aal":"aal2"}', true);
select lives_ok(
  $$ select * from app.create_business_with_owner('Catalog Test', 'catalog-test', 'Main', 'main', 'America/Chicago') $$,
  'owner creates tenant'
);
select lives_ok(
  $$ select app.create_service_draft(
    (select id from public.businesses where public_slug = 'catalog-test'),
    'boarding', 'Standard boarding', 'Overnight boarding', 'overnight_date_range',
    null, 'staff_approval', 'A safe overnight stay.'
  ) $$,
  'owner creates service draft'
);
select is((select status from public.services), 'draft', 'new service remains a draft');
select is((select version_number from public.service_versions), 1, 'first version is numbered one');
select throws_ok(
  $$ select app.set_service_status(
    (select business_id from public.services), (select id from public.services), 'active'
  ) $$,
  '23514', 'service requires a published version', 'draft cannot become active without publication'
);
select lives_ok(
  $$ select app.publish_service_version(
    (select business_id from public.services), (select id from public.services),
    (select id from public.service_versions), (select id from public.locations),
    false, true, true, false
  ) $$,
  'draft publishes for a location'
);
select is((select status from public.services), 'active', 'publication activates stable service');
select is((select status from public.service_versions), 'published', 'version is published');
select ok((select customer_portal and staff_entry and not public_website from public.service_location_enablements), 'channel enablement is explicit');
select throws_ok(
  $$ update public.service_versions set customer_name = 'Mutated name' $$,
  '23514', 'published service versions are immutable', 'published content cannot be changed in place'
);
select lives_ok(
  $$ select app.set_service_status(
    (select business_id from public.services), (select id from public.services), 'paused'
  ) $$,
  'active service can pause'
);

select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated","email":"catalog-outsider@example.test","aal":"aal2"}', true);
select throws_ok(
  $$ select app.set_service_status(
    (select business_id from public.services), (select id from public.services), 'retired'
  ) $$,
  '42501', 'service management unavailable', 'unrelated identity cannot manage catalog'
);

select * from finish();
rollback;
