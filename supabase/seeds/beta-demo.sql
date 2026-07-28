-- Roventra hosted-beta visual review dataset.
--
-- SAFETY:
--   1. Run this file only in the hosted beta Supabase SQL editor.
--   2. Replace the owner email below with an existing verified beta owner account.
--   3. The script creates a separate "Roventra Beta Demo" tenant and synthetic records only.
--   4. It never creates or changes an authentication password.

begin;

select set_config(
  'app.beta_seed_owner_email',
  'replace-with-beta-owner@example.com',
  true
);

do $$
declare
  owner_email text := current_setting('app.beta_seed_owner_email', true);
  owner_count integer;
begin
  if owner_email = 'replace-with-beta-owner@example.com' then
    raise exception 'Replace app.beta_seed_owner_email before running the beta demo seed.';
  end if;

  select count(*) into owner_count
  from auth.users
  where lower(email) = lower(owner_email)
    and email_confirmed_at is not null;

  if owner_count <> 1 then
    raise exception 'Exactly one verified beta owner account must match %.', owner_email;
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id from auth.users where lower(email) = lower(current_setting('app.beta_seed_owner_email', true))),
    'role', 'authenticated',
    'email', current_setting('app.beta_seed_owner_email', true),
    'aal', 'aal2'
  )::text,
  true
);

set local role authenticated;

-- A dedicated synthetic tenant keeps visual-review data away from real beta businesses.
select *
from app.create_business_with_owner(
  'Roventra Beta Demo',
  'roventra-beta-demo',
  'Downtown Pet Resort',
  'downtown',
  'America/Chicago'
)
where not exists (
  select 1 from public.businesses where public_slug = 'roventra-beta-demo'
);

-- The normal onboarding flow activates these after setup review. The synthetic tenant is
-- preconfigured below, so make it selectable without changing the owner's real tenant.
reset role;
update public.businesses
set status = 'active',
    customer_email = 'hello@roventra-demo.example.test',
    customer_phone = '615-555-0100'
where public_slug = 'roventra-beta-demo' and status = 'draft';
update public.locations
set status = 'active',
    customer_email = 'hello@roventra-demo.example.test',
    customer_phone = '615-555-0100',
    address_line_1 = '100 Demo Avenue',
    city = 'Nashville',
    region = 'TN',
    postal_code = '37203'
where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and public_slug = 'downtown'
  and status = 'draft';
update public.platform_tenant_controls
set lifecycle_status = 'active',
    changed_at = now()
where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and lifecycle_status = 'setup';
set local role authenticated;

-- Representative customer households and pets.
select *
from app.create_customer_household_with_pet(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  'Patricia', 'Morgan', 'Pat', 'pat.morgan@example.test', '615-555-0101',
  'Milo', 'Golden Retriever', (current_date - interval '4 years')::date, false, 'male'
)
where not exists (
  select 1 from public.customers
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
    and email = 'pat.morgan@example.test'
);

select *
from app.create_customer_household_with_pet(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  'Nina', 'Chen', '', 'nina.chen@example.test', '615-555-0102',
  'Bella', 'French Bulldog', (current_date - interval '3 years')::date, false, 'female'
)
where not exists (
  select 1 from public.customers
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
    and email = 'nina.chen@example.test'
);

select *
from app.create_customer_household_with_pet(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  'Omar', 'Reed', '', 'omar.reed@example.test', '615-555-0103',
  'Cooper', 'Australian Shepherd', (current_date - interval '2 years')::date, true, 'male'
)
where not exists (
  select 1 from public.customers
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
    and email = 'omar.reed@example.test'
);

-- Published boarding, daycare, and grooming catalog entries.
select app.create_service_draft(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  'boarding', 'Overnight Boarding', 'Overnight Boarding', 'overnight_date_range', null,
  'staff_approval', 'Private suite, daily care, and supervised enrichment.'
)
where not exists (
  select 1 from public.services
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
    and internal_name = 'Overnight Boarding'
);

select app.create_service_draft(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  'daycare', 'Daycare', 'Daycare', 'attendance_day', null,
  'instant', 'Supervised play, rest rotations, and a daily update.'
)
where not exists (
  select 1 from public.services
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
    and internal_name = 'Daycare'
);

select app.create_service_draft(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  'grooming', 'Full Groom', 'Full Groom', 'fixed_appointment', 120,
  'staff_approval', 'Bath, brush, haircut, nail trim, and finishing review.'
)
where not exists (
  select 1 from public.services
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
    and internal_name = 'Full Groom'
);

select app.publish_service_version(
  s.business_id, s.id, sv.id,
  (select id from public.locations where business_id = s.business_id and public_slug = 'downtown'),
  true, true, true, false
)
from public.services s
join public.service_versions sv on sv.business_id = s.business_id and sv.service_id = s.id
where s.business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and s.status = 'draft'
  and sv.status = 'draft';

select app.configure_capacity_pool(
  s.business_id,
  (select id from public.locations where business_id = s.business_id and public_slug = 'downtown'),
  s.id,
  s.internal_name || ' capacity',
  case s.category when 'boarding' then 'pet_count' when 'daycare' then 'pet_count' else 'service_unit' end,
  case s.category when 'boarding' then 1 when 'daycare' then 12 else 4 end,
  case s.category when 'boarding' then 1 when 'daycare' then 10 else 3 end
)
from public.services s
where s.business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and not exists (
    select 1 from public.capacity_pools p
    where p.business_id = s.business_id and p.service_id = s.id
  );

select app.add_capacity_resource(
  p.business_id, p.id, 'SUITE-101', 'Suite 101', 'suite', 1, '{}'::jsonb
)
from public.capacity_pools p
join public.services s on s.business_id = p.business_id and s.id = p.service_id
where p.business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and s.category = 'boarding'
  and not exists (
    select 1 from public.capacity_resources r
    where r.business_id = p.business_id
      and r.capacity_pool_id = p.id
      and r.resource_code = 'SUITE-101'
  );

-- One published commercial bundle supports every sample booking.
select *
from app.create_pricing_bundle(
  (select id from public.businesses where public_slug = 'roventra-beta-demo'),
  (select id from public.locations where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo') and public_slug = 'downtown'),
  'Standard rates', 'USD', 'Standard reservation policy',
  'percentage', 5000, 0, 24, 5000, 10000,
  'Pet care agreement',
  'I authorize Roventra Beta Demo to provide the selected care services.',
  'A fifty-percent deposit confirms approved reservations.'
)
where not exists (
  select 1 from public.price_books
  where business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
);

select app.add_price_rate(
  s.business_id,
  (select id from public.price_book_versions where business_id = s.business_id and status = 'draft'),
  (select id from public.locations where business_id = s.business_id and public_slug = 'downtown'),
  sv.id,
  case s.category when 'boarding' then 'night' when 'daycare' then 'day' else 'appointment' end,
  case s.category when 'boarding' then 6500 when 'daycare' then 3800 else 8500 end,
  case s.category when 'boarding' then 'Boarding night' when 'daycare' then 'Daycare day' else 'Full groom' end,
  100, null, null
)
from public.services s
join public.service_versions sv on sv.business_id = s.business_id and sv.service_id = s.id
where s.business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and sv.status = 'published'
  and not exists (
    select 1 from public.price_rate_rules r
    where r.business_id = s.business_id and r.service_version_id = sv.id
  );

select app.publish_pricing_bundle(
  pbv.business_id,
  pbv.id,
  (select id from public.commercial_policy_versions where business_id = pbv.business_id and status = 'draft'),
  current_date
)
from public.price_book_versions pbv
where pbv.business_id = (select id from public.businesses where public_slug = 'roventra-beta-demo')
  and pbv.status = 'draft';

-- Milo: confirmed boarding stay, checked in, ready for departure with realistic blockers.
select app.create_booking_request(
  b.id, l.id, c.id, p.id, s.id,
  now() - interval '2 hours', now() + interval '2 days', 1, 3,
  null, 'staff', 'beta-demo-milo-boarding'
)
from public.businesses b
join public.locations l on l.business_id = b.id and l.public_slug = 'downtown'
join public.customers c on c.business_id = b.id and c.email = 'pat.morgan@example.test'
join public.household_members hm on hm.business_id = b.id and hm.customer_id = c.id
join public.pets p on p.business_id = b.id and p.household_id = hm.household_id and p.name = 'Milo'
join public.services s on s.business_id = b.id and s.internal_name = 'Overnight Boarding'
where b.public_slug = 'roventra-beta-demo';

select app.resolve_booking_review(
  b.business_id, b.id, 'approved',
  'Manager approved the synthetic beta boarding stay.',
  'beta-demo-milo-approval'
)
from public.bookings b
where b.idempotency_key = 'beta-demo-milo-boarding'
  and b.status in ('action_required', 'pending_approval');

select app.issue_booking_invoice(b.business_id, b.id, 'beta-demo-milo-invoice')
from public.bookings b
where b.idempotency_key = 'beta-demo-milo-boarding'
  and not exists (
    select 1 from public.invoices i where i.business_id = b.business_id and i.booking_id = b.id
  );

select app.record_manual_payment(
  i.business_id, i.id, i.location_id, balances.deposit_due_minor,
  'check', 'BETA-DEPOSIT-101', 'beta-demo-milo-deposit'
)
from public.invoices i
join public.invoice_balances balances on balances.business_id = i.business_id and balances.invoice_id = i.id
where i.idempotency_key = 'beta-demo-milo-invoice'
  and balances.deposit_due_minor > 0;

select app.record_booking_arrival(b.business_id, b.id, 'beta-demo-milo-arrival')
from public.bookings b
where b.idempotency_key = 'beta-demo-milo-boarding'
  and b.status = 'confirmed';

select app.complete_pet_check_in(
  b.business_id, b.id, p.id,
  'Pat Morgan', 'owner', 'photo_id',
  '["name:Milo","breed:Golden Retriever"]'::jsonb,
  '{"notes":"Bright, alert, and comfortable at arrival."}'::jsonb,
  '[{"category":"belonging","name":"Blue leash","quantity":1,"unit":"item","storage":"Cubby 101","return_expected":true}]'::jsonb,
  'beta-demo-milo-check-in'
)
from public.bookings b
join public.customers c on c.business_id = b.business_id and c.id = b.customer_id
join public.household_members hm on hm.business_id = c.business_id and hm.customer_id = c.id
join public.pets p on p.business_id = hm.business_id and p.household_id = hm.household_id and p.name = 'Milo'
join public.pet_visits pv on pv.business_id = b.business_id and pv.pet_id = p.id
where b.idempotency_key = 'beta-demo-milo-boarding'
  and pv.status = 'arrived';

select app.accept_operational_handoff(
  pv.business_id, pv.id, r.id,
  'Blue leash stored in Cubby 101.',
  'beta-demo-milo-handoff'
)
from public.pet_visits pv
join public.pets p on p.business_id = pv.business_id and p.id = pv.pet_id and p.name = 'Milo'
join public.capacity_resources r on r.business_id = pv.business_id and r.resource_code = 'SUITE-101'
where pv.status = 'in_care' and pv.handoff_status = 'pending';

select app.schedule_snapshot_care_task(
  pv.business_id, pv.id, 'feeding', 'Dinner',
  '{"instructions":"Offer one measured cup of provided food with fresh water."}'::jsonb,
  now() + interval '30 minutes', now() + interval '90 minutes',
  'routine', null, 'beta-demo-milo-feeding'
)
from public.pet_visits pv
join public.pets p on p.business_id = pv.business_id and p.id = pv.pet_id and p.name = 'Milo'
where pv.status = 'in_care' and pv.handoff_status = 'accepted';

select app.schedule_snapshot_care_task(
  pv.business_id, pv.id, 'medication', 'Evening medication',
  '{"instructions":"Give one labeled tablet with the evening meal."}'::jsonb,
  now() + interval '2 hours', now() + interval '3 hours',
  'critical', null, 'beta-demo-milo-medication'
)
from public.pet_visits pv
join public.pets p on p.business_id = pv.business_id and p.id = pv.pet_id and p.name = 'Milo'
where pv.status = 'in_care' and pv.handoff_status = 'accepted';

select app.initialize_service_execution(pv.business_id, pv.id, 'beta-demo-milo-execution')
from public.pet_visits pv
join public.pets p on p.business_id = pv.business_id and p.id = pv.pet_id and p.name = 'Milo'
where pv.status = 'in_care' and pv.handoff_status = 'accepted';

select app.transition_service_execution(
  e.business_id, e.id, 'active', 'Milo settled comfortably into Suite 101.', 'beta-demo-milo-active'
)
from public.service_executions e
join public.pets p on p.business_id = e.business_id and p.id = e.pet_id and p.name = 'Milo'
where e.stage = 'settling';

select app.create_operational_incident(
  e.business_id, e.pet_visit_id, e.id,
  'behavior', 'minor', now(),
  'Milo barked repeatedly during the first group transition.',
  'Staff moved Milo to a quieter transition route.',
  'Monitor future group transitions for overstimulation.',
  'Milo became excited during a transition and settled with a quieter route.',
  'beta-demo-milo-incident'
)
from public.service_executions e
join public.pets p on p.business_id = e.business_id and p.id = e.pet_id and p.name = 'Milo'
where e.stage = 'active';

select app.transition_operational_incident(
  i.business_id, i.id, 'under_review',
  'Manager is reviewing transition handling for the remainder of the stay.',
  true,
  'We adjusted Milo''s transition plan and he is comfortable.',
  'beta-demo-milo-incident-review'
)
from public.operational_incidents i
where i.idempotency_key = 'beta-demo-milo-incident' and i.status = 'open';

select app.transition_service_execution(
  e.business_id, e.id, 'departure_preparation', '', 'beta-demo-milo-departure-prep'
)
from public.service_executions e
join public.pets p on p.business_id = e.business_id and p.id = e.pet_id and p.name = 'Milo'
where e.stage = 'active';

select app.transition_service_execution(
  e.business_id, e.id, 'ready',
  'Final care, report card, and belongings review completed.',
  'beta-demo-milo-ready'
)
from public.service_executions e
join public.pets p on p.business_id = e.business_id and p.id = e.pet_id and p.name = 'Milo'
where e.stage = 'departure_preparation';

select app.create_report_card_draft(
  e.business_id, e.id,
  'Milo settled into his suite, enjoyed calm one-on-one attention, and responded well to a quieter transition route.',
  '{"mood":"content","favorite_activity":"one-on-one yard time"}'::jsonb,
  'beta-demo-milo-report-card'
)
from public.service_executions e
join public.pets p on p.business_id = e.business_id and p.id = e.pet_id and p.name = 'Milo'
where e.stage = 'ready';

select app.transition_report_card(c.business_id, c.id, 'review', 'Ready for manager review.', 'beta-demo-card-review')
from public.report_cards c
join public.pets p on p.business_id = c.business_id and p.id = c.pet_id and p.name = 'Milo'
where c.status = 'draft';

select app.transition_report_card(c.business_id, c.id, 'approved', 'Customer-safe content verified.', 'beta-demo-card-approved')
from public.report_cards c
join public.pets p on p.business_id = c.business_id and p.id = c.pet_id and p.name = 'Milo'
where c.status = 'review';

select app.transition_report_card(c.business_id, c.id, 'published', 'Published for customer review.', 'beta-demo-card-published')
from public.report_cards c
join public.pets p on p.business_id = c.business_id and p.id = c.pet_id and p.name = 'Milo'
where c.status = 'approved';

-- Bella: a future confirmed daycare reservation visible in calendar and arrivals.
select app.create_booking_request(
  b.id, l.id, c.id, p.id, s.id,
  date_trunc('day', now()) + interval '1 day 8 hours',
  date_trunc('day', now()) + interval '1 day 17 hours',
  1, 1, null, 'customer_portal', 'beta-demo-bella-daycare'
)
from public.businesses b
join public.locations l on l.business_id = b.id and l.public_slug = 'downtown'
join public.customers c on c.business_id = b.id and c.email = 'nina.chen@example.test'
join public.household_members hm on hm.business_id = b.id and hm.customer_id = c.id
join public.pets p on p.business_id = b.id and p.household_id = hm.household_id and p.name = 'Bella'
join public.services s on s.business_id = b.id and s.internal_name = 'Daycare'
where b.public_slug = 'roventra-beta-demo';

select app.issue_booking_invoice(b.business_id, b.id, 'beta-demo-bella-invoice')
from public.bookings b
where b.idempotency_key = 'beta-demo-bella-daycare'
  and not exists (select 1 from public.invoices i where i.business_id = b.business_id and i.booking_id = b.id);

select app.record_manual_payment(
  i.business_id, i.id, i.location_id, balances.deposit_due_minor,
  'external_card', 'BETA-CARD-202', 'beta-demo-bella-deposit'
)
from public.invoices i
join public.invoice_balances balances on balances.business_id = i.business_id and balances.invoice_id = i.id
where i.idempotency_key = 'beta-demo-bella-invoice' and balances.deposit_due_minor > 0;

-- Cooper: a pending grooming request demonstrates the approval state.
select app.create_booking_request(
  b.id, l.id, c.id, p.id, s.id,
  date_trunc('day', now()) + interval '3 days 10 hours',
  date_trunc('day', now()) + interval '3 days 12 hours',
  1, 1, null, 'public_website', 'beta-demo-cooper-grooming'
)
from public.businesses b
join public.locations l on l.business_id = b.id and l.public_slug = 'downtown'
join public.customers c on c.business_id = b.id and c.email = 'omar.reed@example.test'
join public.household_members hm on hm.business_id = b.id and hm.customer_id = c.id
join public.pets p on p.business_id = b.id and p.household_id = hm.household_id and p.name = 'Cooper'
join public.services s on s.business_id = b.id and s.internal_name = 'Full Groom'
where b.public_slug = 'roventra-beta-demo';

-- One active waitlist entry fills the capacity-recovery panel.
select app.create_waitlist_entry(
  b.id, l.id, c.id, p.id, s.id,
  now() + interval '1 day', now() + interval '2 days',
  1, 2, 'beta-demo-cooper-waitlist'
)
from public.businesses b
join public.locations l on l.business_id = b.id and l.public_slug = 'downtown'
join public.customers c on c.business_id = b.id and c.email = 'omar.reed@example.test'
join public.household_members hm on hm.business_id = b.id and hm.customer_id = c.id
join public.pets p on p.business_id = b.id and p.household_id = hm.household_id and p.name = 'Cooper'
join public.services s on s.business_id = b.id and s.internal_name = 'Overnight Boarding'
where b.public_slug = 'roventra-beta-demo'
  and not exists (
    select 1 from public.waitlist_entries w
    where w.business_id = b.id and w.idempotency_key = 'beta-demo-cooper-waitlist'
  );

reset role;
commit;
