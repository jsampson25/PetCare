begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner-a@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Owner A"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'owner-b@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Owner B"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

select is(
  (select count(*)::integer from public.identity_profiles where status = 'active'),
  2,
  'confirmed auth users receive active application profiles'
);

select is(
  (select count(*)::integer from public.role_definitions),
  8,
  'the predefined MVP role catalog is seeded'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner-a@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Business A', 'business-a', 'Location A', 'main', 'America/Chicago'
  ) $$,
  'verified identity A can create a tenant, first location, and owner membership atomically'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated","email":"owner-b@example.test","aal":"aal2"}', true);

select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Business B', 'business-b', 'Location B', 'main', 'America/New_York'
  ) $$,
  'verified identity B can create an independent tenant'
);

reset role;

select is((select count(*)::integer from public.businesses), 2, 'two businesses were created');
select is((select count(*)::integer from public.locations), 2, 'each business received one location');
select is((select count(*)::integer from public.business_memberships), 2, 'each owner received one membership');
select is((select count(*)::integer from public.membership_roles where role_key = 'owner'), 2, 'each membership received the owner role');
select is((select count(*)::integer from public.audit_events where event_type = 'business.created'), 2, 'business creation is audited');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner-a@example.test","aal":"aal2"}', true);

select is((select count(*)::integer from public.businesses), 1, 'RLS exposes only identity A business');
select is((select public_slug from public.businesses), 'business-a', 'identity A cannot substitute business B identifier');
select is((select count(*)::integer from public.locations), 1, 'location RLS follows tenant and membership scope');
select ok(
  app.member_has_permission((select id from public.businesses), 'business.manage_security'),
  'the active owner receives the owner permission template'
);
select ok(
  app.member_can_access_location(
    (select id from public.businesses),
    (select id from public.locations)
  ),
  'all-current location scope includes the first active location'
);
select is(
  app.is_active_business_member(
    (select id from public.businesses where public_slug = 'business-b')
  ),
  false,
  'a foreign tenant does not become active through a supplied identifier'
);
select results_eq(
  $$
    with changed as (
      update public.businesses
      set name = 'Unauthorized change'
      where public_slug = 'business-b'
      returning id
    )
    select count(*)::bigint from changed
  $$,
  $$ values (0::bigint) $$,
  'cross-tenant update changes no rows and does not reveal existence'
);

reset role;

select throws_like(
  $$
    insert into public.membership_location_scopes (business_id, membership_id, location_id)
    select business_a.id, membership_a.id, location_b.id
    from public.businesses business_a
    join public.business_memberships membership_a on membership_a.business_id = business_a.id
    cross join public.locations location_b
    join public.businesses business_b on business_b.id = location_b.business_id
    where business_a.public_slug = 'business-a'
      and business_b.public_slug = 'business-b'
  $$,
  '%violates foreign key constraint%',
  'composite foreign keys reject cross-tenant location scope'
);

select throws_ok(
  $$
    update public.locations
    set business_id = (select id from public.businesses where public_slug = 'business-b')
    where business_id = (select id from public.businesses where public_slug = 'business-a')
  $$,
  '23514',
  'business_id is immutable',
  'tenant ownership cannot be changed by ordinary update'
);

select throws_ok(
  $$ delete from public.audit_events where event_type = 'business.created' $$,
  '55000',
  'audit events are append-only',
  'audit history cannot be deleted'
);

select throws_ok(
  $$
    update public.business_memberships
    set state = 'revoked', revoked_at = now()
    where business_id = (select id from public.businesses where public_slug = 'business-a')
  $$,
  '23514',
  'the last active owner cannot be removed',
  'last-owner protection blocks membership revocation'
);

select throws_ok(
  $$
    delete from public.membership_roles
    where business_id = (select id from public.businesses where public_slug = 'business-a')
      and role_key = 'owner'
  $$,
  '23514',
  'the last active owner role cannot be removed',
  'last-owner protection blocks owner-role removal'
);

select * from finish();
rollback;
