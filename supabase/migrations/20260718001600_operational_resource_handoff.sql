-- PetCare E09 named-resource assignment, receiving-staff handoff, and arrival communication.
alter table public.pet_visits add column handoff_status text not null default 'pending' check(handoff_status in('pending','accepted','exception'));

create table public.visit_resource_assignments(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,capacity_resource_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'active' check(status in('active','released','cancelled')),
 assignment_reason text not null default 'check_in',assigned_by uuid not null references auth.users(id) on delete restrict default auth.uid(),assigned_at timestamptz not null default now(),
 released_by uuid references auth.users(id) on delete restrict,released_at timestamptz,release_reason text,idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,capacity_resource_id) references public.capacity_resources(business_id,id) on delete restrict,
 check(ends_at>starts_at),check((released_at is null)=(released_by is null)),check(status='active' or released_at is not null)
);
create index visit_resource_schedule_idx on public.visit_resource_assignments(business_id,capacity_resource_id,starts_at,ends_at) where status='active';
create unique index visit_resource_one_active_pet_idx on public.visit_resource_assignments(business_id,pet_visit_id) where status='active';

create table public.operational_handoffs(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,
 resource_assignment_id uuid,receiving_staff_id uuid not null references auth.users(id) on delete restrict,handoff_notes text,
 accepted_by uuid not null references auth.users(id) on delete restrict default auth.uid(),accepted_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,pet_visit_id),unique(business_id,idempotency_key),
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,resource_assignment_id) references public.visit_resource_assignments(business_id,id) on delete restrict
);

create trigger visit_resource_assignments_tenant before update on public.visit_resource_assignments for each row execute function app.prevent_business_id_change();
create trigger resource_assignment_audit after insert or update or delete on public.visit_resource_assignments for each row execute function app.audit_configuration_change('operations.resource_assignment.changed','visit_resource_assignment');
create trigger operational_handoffs_immutable before update or delete on public.operational_handoffs for each row execute function app.prevent_commercial_snapshot_change();

alter table public.transactional_message_outbox drop constraint transactional_message_outbox_message_type_check;
alter table public.transactional_message_outbox add constraint transactional_message_outbox_message_type_check check(message_type in('invoice_issued','payment_receipt','payment_failed','refund_issued','booking_confirmed','pet_checked_in'));

create or replace function app.accept_operational_handoff(
 target_business_id uuid,target_pet_visit_id uuid,target_resource_id uuid,handoff_note text,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;v public.operational_visits%rowtype;i public.booking_items%rowtype;r public.capacity_resources%rowtype;assignment_id uuid;handoff_id uuid;active_count integer;customer_id_value uuid;pet_name_value text;booking_number_value text;
begin
 if not app.member_has_permission(target_business_id,'operations.check_in') then raise exception 'operational handoff unavailable' using errcode='42501';end if;
 select id into handoff_id from public.operational_handoffs where business_id=target_business_id and idempotency_key=trim(request_key);if handoff_id is not null then return handoff_id;end if;
 select * into pv from public.pet_visits where business_id=target_business_id and id=target_pet_visit_id for update;
 if pv.id is null or pv.status<>'in_care' or pv.handoff_status<>'pending' then raise exception 'pet handoff unavailable' using errcode='P0002';end if;
 select * into v from public.operational_visits where business_id=target_business_id and id=pv.operational_visit_id;
 if not app.member_can_access_location(target_business_id,v.location_id) then raise exception 'pet handoff unavailable' using errcode='P0002';end if;
 if not exists(select 1 from public.business_memberships m where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active') then raise exception 'receiving staff unavailable' using errcode='42501';end if;
 select * into i from public.booking_items where business_id=target_business_id and id=pv.booking_item_id;
 if target_resource_id is not null then
  select cr.* into r from public.capacity_resources cr join public.capacity_pools cp on cp.business_id=cr.business_id and cp.id=cr.capacity_pool_id
  join public.service_versions sv on sv.business_id=cp.business_id and sv.service_id=cp.service_id
  where cr.business_id=target_business_id and cr.id=target_resource_id and cp.location_id=v.location_id and sv.id=i.service_version_id for update of cr;
  if r.id is null or r.status not in('ready','occupied') then raise exception 'ready compatible resource unavailable' using errcode='P0002';end if;
  select count(*) into active_count from public.visit_resource_assignments a where a.business_id=target_business_id and a.capacity_resource_id=r.id and a.status='active' and a.starts_at<v.scheduled_end and a.ends_at>v.scheduled_start;
  if active_count>=r.max_pets then raise exception 'resource is already at physical capacity' using errcode='P0001';end if;
  insert into public.visit_resource_assignments(business_id,operational_visit_id,pet_visit_id,capacity_resource_id,starts_at,ends_at,idempotency_key)
  values(target_business_id,v.id,pv.id,r.id,v.scheduled_start,v.scheduled_end,trim(request_key)||'-resource') returning id into assignment_id;
  if active_count+1>=r.max_pets then update public.capacity_resources set status='occupied' where business_id=target_business_id and id=r.id;end if;
 end if;
 insert into public.operational_handoffs(business_id,operational_visit_id,pet_visit_id,resource_assignment_id,receiving_staff_id,handoff_notes,idempotency_key)
 values(target_business_id,v.id,pv.id,assignment_id,auth.uid(),nullif(trim(handoff_note),''),trim(request_key)) returning id into handoff_id;
 update public.pet_visits set handoff_status='accepted' where id=pv.id;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id)
 values(target_business_id,v.id,pv.id,'operational_handoff_accepted','Receiving staff accepted the pet into operations.',jsonb_build_object('handoff_id',handoff_id,'resource_assignment_id',assignment_id),auth.uid());
 select b.customer_id,b.booking_number,p.name into customer_id_value,booking_number_value,pet_name_value from public.bookings b join public.pets p on p.business_id=b.business_id and p.id=pv.pet_id where b.business_id=target_business_id and b.id=v.booking_id;
 insert into public.transactional_message_outbox(business_id,customer_id,booking_id,message_type,channel,template_data,idempotency_key)
 values(target_business_id,customer_id_value,v.booking_id,'pet_checked_in','email',jsonb_build_object('pet_name',pet_name_value,'booking_number',booking_number_value),'pet-checked-in-'||pv.id::text) on conflict(business_id,idempotency_key) do nothing;
 return handoff_id;
end;$$;

alter table public.visit_resource_assignments enable row level security;alter table public.visit_resource_assignments force row level security;
alter table public.operational_handoffs enable row level security;alter table public.operational_handoffs force row level security;
create policy visit_resource_assignments_view on public.visit_resource_assignments for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=visit_resource_assignments.business_id and v.id=visit_resource_assignments.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
create policy operational_handoffs_view on public.operational_handoffs for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=operational_handoffs.business_id and v.id=operational_handoffs.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
revoke all on public.visit_resource_assignments,public.operational_handoffs from anon,authenticated;grant select on public.visit_resource_assignments,public.operational_handoffs to authenticated;
revoke all on function app.accept_operational_handoff(uuid,uuid,uuid,text,text) from public;grant execute on function app.accept_operational_handoff(uuid,uuid,uuid,text,text) to authenticated;
