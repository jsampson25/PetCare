begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '31000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'owner@example.test', '', now(), '{}'::jsonb, '{"display_name":"Owner"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '32000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'manager@example.test', '', now(), '{}'::jsonb, '{"display_name":"Manager"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'outsider@example.test', '', now(), '{}'::jsonb, '{"display_name":"Outsider"}'::jsonb,
    now(), now(), '', '', '', ''
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test","aal":"aal1"}',
  true
);
select lives_ok(
  $$ select * from app.create_business_with_owner(
    'Invitation Test', 'invitation-test', 'Main', 'main', 'America/Chicago'
  ) $$,
  'owner fixture can provision a business'
);

reset role;
create temporary table invitation_test_context (
  business_id uuid,
  location_id uuid,
  manager_invitation_id uuid,
  manager_token text,
  owner_invitation_id uuid,
  owner_token text,
  revoked_invitation_id uuid,
  revoked_token text
) on commit drop;
grant select, update on invitation_test_context to authenticated;
insert into invitation_test_context (business_id, location_id)
select business.id, location.id
from public.businesses business
join public.locations location on location.business_id = business.id
where business.public_slug = 'invitation-test';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test","aal":"aal1"}',
  true
);
with created as (
  select * from app.create_staff_invitation(
    (select business_id from invitation_test_context),
    '  MANAGER@example.test  ',
    array['manager'],
    'selected',
    array[(select location_id from invitation_test_context)],
    interval '7 days'
  )
)
update invitation_test_context context
set manager_invitation_id = created.invitation_id,
    manager_token = created.invitation_token
from created;

select ok(
  (select manager_invitation_id is not null from invitation_test_context),
  'authorized owner creates a staff invitation'
);
select is(
  (select email from public.staff_invitations where id = (select manager_invitation_id from invitation_test_context)),
  'manager@example.test',
  'invitation email is normalized'
);
select is(
  (select char_length(manager_token) from invitation_test_context),
  64,
  'a high-entropy token is returned once'
);
select isnt(
  (select encode(token_digest, 'hex') from public.staff_invitations where id = (select manager_invitation_id from invitation_test_context)),
  (select manager_token from invitation_test_context),
  'the raw invitation token is not stored'
);
select is(
  (select count(*)::integer from public.staff_invitation_roles where role_key = 'manager'),
  1,
  'requested role is stored separately'
);
select is(
  (select count(*)::integer from public.staff_invitation_location_scopes),
  1,
  'selected location scope is stored separately'
);
select is(
  (select count(*)::integer from public.audit_events where event_type = 'staff.invitation_created'),
  1,
  'invitation creation is audited'
);
select throws_ok(
  $$ select * from app.create_staff_invitation(
    (select business_id from invitation_test_context),
    'owner-two@example.test', array['owner'], 'all_current', array[]::uuid[]
  ) $$,
  '42501',
  'owner invitations require MFA step-up'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33000000-0000-4000-8000-000000000003","role":"authenticated","email":"outsider@example.test","aal":"aal1"}',
  true
);
select throws_ok(
  $$ select * from app.accept_staff_invitation((select manager_token from invitation_test_context)) $$,
  'P0002',
  'a token cannot be accepted by a different email identity'
);
select is(
  (select count(*)::integer from public.staff_invitations),
  0,
  'invitation rows are not exposed to an unrelated identity'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000002","role":"authenticated","email":"manager@example.test","aal":"aal1"}',
  true
);
select lives_ok(
  $$ select * from app.accept_staff_invitation((select manager_token from invitation_test_context)) $$,
  'the intended verified identity accepts the invitation'
);

reset role;
select is(
  (select state from public.staff_invitations where id = (select manager_invitation_id from invitation_test_context)),
  'accepted',
  'accepted invitation becomes terminal'
);
select is(
  (select count(*)::integer from public.business_memberships
   where identity_id = '32000000-0000-4000-8000-000000000002' and state = 'active'),
  1,
  'acceptance creates an active membership'
);
select is(
  (select count(*)::integer from public.membership_roles role_assignment
   join public.business_memberships membership on membership.id = role_assignment.membership_id
   where membership.identity_id = '32000000-0000-4000-8000-000000000002'
     and role_assignment.role_key = 'manager'),
  1,
  'acceptance applies the invited role'
);
select is(
  (select count(*)::integer from public.membership_location_scopes scope
   join public.business_memberships membership on membership.id = scope.membership_id
   where membership.identity_id = '32000000-0000-4000-8000-000000000002'),
  1,
  'acceptance applies the invited location scope'
);
select is(
  (select count(*)::integer from public.audit_events where event_type = 'staff.invitation_accepted'),
  1,
  'invitation acceptance is audited'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000002","role":"authenticated","email":"manager@example.test","aal":"aal1"}',
  true
);
select throws_ok(
  $$ select * from app.accept_staff_invitation((select manager_token from invitation_test_context)) $$,
  'P0002',
  'an accepted token cannot be reused'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test","aal":"aal1"}',
  true
);
with created as (
  select * from app.create_staff_invitation(
    (select business_id from invitation_test_context),
    'revoked@example.test', array['front_desk'], 'all_current', array[]::uuid[]
  )
)
update invitation_test_context context
set revoked_invitation_id = created.invitation_id, revoked_token = created.invitation_token
from created;
select lives_ok(
  $$ select app.revoke_staff_invitation((select revoked_invitation_id from invitation_test_context)) $$,
  'authorized owner revokes a pending invitation'
);

reset role;
select is(
  (select state from public.staff_invitations where id = (select revoked_invitation_id from invitation_test_context)),
  'revoked',
  'revocation makes the invitation terminal'
);
select is(
  (select count(*)::integer from public.audit_events where event_type = 'staff.invitation_revoked'),
  1,
  'revocation is audited'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test","aal":"aal2"}',
  true
);
with created as (
  select * from app.create_staff_invitation(
    (select business_id from invitation_test_context),
    'owner-two@example.test', array['owner'], 'all_current', array[]::uuid[]
  )
)
update invitation_test_context context
set owner_invitation_id = created.invitation_id, owner_token = created.invitation_token
from created;
select ok(
  (select owner_invitation_id is not null from invitation_test_context),
  'AAL2 permits an owner invitation'
);
select is(
  (select count(*)::integer from public.staff_invitations where state = 'pending'),
  1,
  'only the new owner invitation remains pending'
);
select throws_ok(
  $$ select * from app.create_staff_invitation(
    (select business_id from invitation_test_context),
    'bad-scope@example.test', array['manager'], 'selected',
    array['ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid]
  ) $$,
  '22023',
  'cross-tenant or unknown locations are rejected'
);
select throws_ok(
  $$ select * from app.create_staff_invitation(
    (select business_id from invitation_test_context),
    'unknown-role@example.test', array['super_admin'], 'all_current', array[]::uuid[]
  ) $$,
  '22023',
  'unknown roles are rejected'
);
select is(
  (select count(*)::integer from public.staff_invitations
   where token_digest = extensions.digest((select owner_token from invitation_test_context), 'sha256')),
  1,
  'stored digest resolves exactly one invitation'
);

select * from finish();
rollback;
