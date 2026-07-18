-- PetCare E11 checkout readiness, custody release, and resource turnover.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.check_out','Verify pickup authority and complete pet checkout.','sensitive') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.check_out'),('manager','operations.check_out'),('front_desk','operations.check_out') on conflict do nothing;

create table public.checkout_overrides(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,pet_visit_id uuid not null,blocker_type text not null check(blocker_type in('pickup_authority','service_not_ready','open_care','open_incident','report_card_missing','balance_due','custody_exception')),
 reason text not null check(char_length(trim(reason)) between 12 and 1000),approved_by uuid not null references auth.users(id) on delete restrict default auth.uid(),approved_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict
);
create index checkout_overrides_pet_idx on public.checkout_overrides(business_id,pet_visit_id,blocker_type,approved_at desc);
create trigger checkout_overrides_immutable before update or delete on public.checkout_overrides for each row execute function app.prevent_commercial_snapshot_change();

create table public.pet_pickup_authorizations(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,pet_id uuid not null,authorized_person_name text not null check(char_length(trim(authorized_person_name)) between 2 and 160),
 relationship_label text not null check(char_length(trim(relationship_label)) between 2 and 100),valid_from timestamptz not null default now(),valid_until timestamptz,status text not null default 'active' check(status in('active','revoked','expired')),
 authorization_notes text not null check(char_length(trim(authorization_notes)) between 8 and 1000),created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,check(valid_until is null or valid_until>valid_from)
);
create index pet_pickup_authorizations_lookup_idx on public.pet_pickup_authorizations(business_id,pet_id,status,valid_from,valid_until);
create trigger pickup_authorizations_tenant before update on public.pet_pickup_authorizations for each row execute function app.prevent_business_id_change();
create trigger pickup_authorizations_audit after insert or update or delete on public.pet_pickup_authorizations for each row execute function app.audit_configuration_change('operations.pickup_authorization.changed','pet_pickup_authorization');

create table public.check_out_records(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,
 pickup_person_name text not null check(char_length(trim(pickup_person_name)) between 2 and 160),pickup_relationship text not null check(pickup_relationship in('owner','household_member','authorized_pickup','other')),
 verification_method text not null check(verification_method in('photo_id','account_questions','known_customer','other')),verification_evidence jsonb not null check(jsonb_typeof(verification_evidence)='array' and jsonb_array_length(verification_evidence)>=2),
 reconciliation_snapshot jsonb not null check(jsonb_typeof(reconciliation_snapshot)='object'),handoff_notes text,acknowledged boolean not null,
 completed_by uuid not null references auth.users(id) on delete restrict default auth.uid(),completed_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,pet_visit_id),unique(business_id,idempotency_key),foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict
);
create trigger check_out_records_immutable before update or delete on public.check_out_records for each row execute function app.prevent_commercial_snapshot_change();

create table public.custody_item_returns(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,check_out_record_id uuid not null,visit_custody_item_id uuid not null,
 return_status text not null check(return_status in('returned','consumed','disposed','missing','damaged')),notes text,recorded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),recorded_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,visit_custody_item_id),foreign key(business_id,check_out_record_id) references public.check_out_records(business_id,id) on delete restrict,
 foreign key(business_id,visit_custody_item_id) references public.visit_custody_items(business_id,id) on delete restrict
);
create trigger custody_item_returns_immutable before update or delete on public.custody_item_returns for each row execute function app.prevent_commercial_snapshot_change();

create table public.resource_turnover_tasks(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,capacity_resource_id uuid not null,source_assignment_id uuid not null,
 status text not null default 'cleaning_required' check(status in('cleaning_required','cleaning','inspection_required','ready','failed')),created_at timestamptz not null default now(),completed_at timestamptz,
 unique(business_id,id),unique(business_id,source_assignment_id),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,capacity_resource_id) references public.capacity_resources(business_id,id) on delete restrict,foreign key(business_id,source_assignment_id) references public.visit_resource_assignments(business_id,id) on delete restrict
);
create trigger resource_turnover_tasks_tenant before update on public.resource_turnover_tasks for each row execute function app.prevent_business_id_change();
create trigger resource_turnover_tasks_audit after insert or update or delete on public.resource_turnover_tasks for each row execute function app.audit_configuration_change('operations.resource_turnover.changed','resource_turnover_task');

create or replace function app.record_checkout_override(target_business_id uuid,target_pet_visit_id uuid,blocker_value text,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$declare created_id uuid;manager_role boolean;begin
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into manager_role;
 if not manager_role then raise exception 'manager checkout override required' using errcode='42501';end if;select id into created_id from public.checkout_overrides where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 if blocker_value not in('pickup_authority','service_not_ready','open_care','open_incident','report_card_missing','balance_due','custody_exception') or char_length(trim(coalesce(reason_value,'')))<12 or not exists(select 1 from public.pet_visits pv join public.operational_visits ov on ov.business_id=pv.business_id and ov.id=pv.operational_visit_id where pv.business_id=target_business_id and pv.id=target_pet_visit_id and pv.status='in_care' and app.member_can_access_location(ov.business_id,ov.location_id)) then raise exception 'documented checkout override unavailable' using errcode='22023';end if;
 insert into public.checkout_overrides(business_id,pet_visit_id,blocker_type,reason,idempotency_key) values(target_business_id,target_pet_visit_id,blocker_value,trim(reason_value),trim(request_key)) returning id into created_id;return created_id;end;$$;

create or replace function app.complete_pet_checkout(target_business_id uuid,target_pet_visit_id uuid,pickup_name_value text,relationship_value text,verification_value text,evidence_value jsonb,returns_value jsonb,handoff_value text,acknowledged_value boolean,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;v public.operational_visits%rowtype;e public.service_executions%rowtype;created_id uuid;item jsonb;invoice_id_value uuid;balance_value bigint;blockers jsonb;assignment public.visit_resource_assignments%rowtype;authority_valid boolean;
begin
 if not app.member_has_permission(target_business_id,'operations.check_out') then raise exception 'checkout unavailable' using errcode='42501';end if;
 select id into created_id from public.check_out_records where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select p.* into pv from public.pet_visits p join public.operational_visits ov on ov.business_id=p.business_id and ov.id=p.operational_visit_id where p.business_id=target_business_id and p.id=target_pet_visit_id and p.status='in_care' and app.member_can_access_location(ov.business_id,ov.location_id) for update of p;
 select * into v from public.operational_visits where business_id=target_business_id and id=pv.operational_visit_id for update;select * into e from public.service_executions where business_id=target_business_id and pet_visit_id=pv.id;
 select i.id,b.balance_due_minor into invoice_id_value,balance_value from public.invoices i join public.invoice_balances b on b.business_id=i.business_id and b.invoice_id=i.id where i.business_id=target_business_id and i.booking_id=v.booking_id and i.status<>'void';
 select exists(select 1 from public.pets p join public.household_members hm on hm.business_id=p.business_id and hm.household_id=p.household_id join public.customers c on c.business_id=hm.business_id and c.id=hm.customer_id where p.business_id=target_business_id and p.id=pv.pet_id and c.status='active' and lower(trim(c.first_name||' '||c.last_name))=lower(trim(pickup_name_value))) or exists(select 1 from public.pet_pickup_authorizations a where a.business_id=target_business_id and a.pet_id=pv.pet_id and a.status='active' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()) and lower(trim(a.authorized_person_name))=lower(trim(pickup_name_value))) into authority_valid;
 blockers:=jsonb_build_object(
  'pickup_authority',not coalesce(authority_valid,false),
  'service_not_ready',e.id is null or e.stage not in('ready','completed'),
  'open_care',exists(select 1 from public.care_tasks t where t.business_id=target_business_id and t.pet_visit_id=pv.id and t.status in('scheduled','in_progress')) or exists(select 1 from public.operational_alerts a where a.business_id=target_business_id and a.pet_visit_id=pv.id and a.status in('open','acknowledged')),
  'open_incident',exists(select 1 from public.operational_incidents i where i.business_id=target_business_id and i.pet_visit_id=pv.id and i.status not in('resolved','closed')),
  'report_card_missing',not exists(select 1 from public.report_cards r where r.business_id=target_business_id and r.pet_visit_id=pv.id and r.status='published'),
  'balance_due',coalesce(balance_value,0)>0);
 if pv.id is null or not coalesce(acknowledged_value,false) or relationship_value not in('owner','household_member','authorized_pickup','other') or verification_value not in('photo_id','account_questions','known_customer','other') or jsonb_typeof(evidence_value)<>'array' or jsonb_array_length(evidence_value)<2 or (select count(distinct trim(value)) from jsonb_array_elements_text(evidence_value))<2 or jsonb_typeof(coalesce(returns_value,'[]'))<>'array' then raise exception 'pickup verification and reconciliation required' using errcode='22023';end if;
 if exists(select 1 from jsonb_each_text(blockers) b where b.value::boolean and not exists(select 1 from public.checkout_overrides o where o.business_id=target_business_id and o.pet_visit_id=pv.id and o.blocker_type=b.key)) then raise exception 'checkout blockers remain unresolved' using errcode='P0001';end if;
 if exists(select 1 from public.visit_custody_items c where c.business_id=target_business_id and c.pet_visit_id=pv.id and c.return_expected and not exists(select 1 from jsonb_array_elements(returns_value) r where (r->>'item_id')::uuid=c.id)) then raise exception 'custody reconciliation incomplete' using errcode='P0001';end if;
 if exists(select 1 from jsonb_array_elements(returns_value) r where r->>'status' in('missing','damaged')) and not exists(select 1 from public.checkout_overrides o where o.business_id=target_business_id and o.pet_visit_id=pv.id and o.blocker_type='custody_exception') then raise exception 'custody exception requires manager approval' using errcode='P0001';end if;
 insert into public.check_out_records(business_id,operational_visit_id,pet_visit_id,pet_id,pickup_person_name,pickup_relationship,verification_method,verification_evidence,reconciliation_snapshot,handoff_notes,acknowledged,idempotency_key)
 values(target_business_id,v.id,pv.id,pv.pet_id,trim(pickup_name_value),relationship_value,verification_value,evidence_value,jsonb_build_object('blockers',blockers,'invoice_id',invoice_id_value,'balance_due_minor',coalesce(balance_value,0)),nullif(trim(handoff_value),''),true,trim(request_key)) returning id into created_id;
 for item in select value from jsonb_array_elements(returns_value) loop insert into public.custody_item_returns(business_id,check_out_record_id,visit_custody_item_id,return_status,notes) values(target_business_id,created_id,(item->>'item_id')::uuid,item->>'status',nullif(trim(item->>'notes'),''));end loop;
 update public.pet_visits set status='checked_out' where id=pv.id;update public.service_executions set stage='completed',completed_at=coalesce(completed_at,now()) where id=e.id and stage='ready';update public.booking_items set status='completed' where business_id=target_business_id and id=pv.booking_item_id;
 for assignment in select * from public.visit_resource_assignments where business_id=target_business_id and pet_visit_id=pv.id and status='active' for update loop update public.visit_resource_assignments set status='released',released_by=auth.uid(),released_at=now(),release_reason='pet_checked_out' where id=assignment.id;if not exists(select 1 from public.visit_resource_assignments a where a.business_id=target_business_id and a.capacity_resource_id=assignment.capacity_resource_id and a.status='active') then update public.capacity_resources set status='cleaning' where business_id=target_business_id and id=assignment.capacity_resource_id;insert into public.resource_turnover_tasks(business_id,location_id,capacity_resource_id,source_assignment_id) values(target_business_id,v.location_id,assignment.capacity_resource_id,assignment.id) on conflict do nothing;end if;end loop;
 if not exists(select 1 from public.pet_visits p where p.business_id=target_business_id and p.operational_visit_id=v.id and p.status<>'checked_out') then update public.operational_visits set status='checked_out' where id=v.id;end if;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,v.id,pv.id,'pet_checked_out','Pickup authority, custody, care, and financial readiness reconciled.',jsonb_build_object('check_out_record_id',created_id),auth.uid());return created_id;
end;$$;

do $$declare n text;begin foreach n in array array['checkout_overrides','pet_pickup_authorizations','check_out_records','custody_item_returns','resource_turnover_tasks'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);end loop;end$$;
create policy checkout_overrides_view on public.checkout_overrides for select to authenticated using(app.member_has_permission(business_id,'operations.check_out') and exists(select 1 from public.pet_visits pv join public.operational_visits ov on ov.business_id=pv.business_id and ov.id=pv.operational_visit_id where pv.business_id=checkout_overrides.business_id and pv.id=checkout_overrides.pet_visit_id and app.member_can_access_location(ov.business_id,ov.location_id)));
create policy check_out_records_view on public.check_out_records for select to authenticated using(app.member_has_permission(business_id,'operations.check_out') and exists(select 1 from public.operational_visits ov where ov.business_id=check_out_records.business_id and ov.id=check_out_records.operational_visit_id and app.member_can_access_location(ov.business_id,ov.location_id)));
create policy pickup_authorizations_view on public.pet_pickup_authorizations for select to authenticated using(app.member_has_permission(business_id,'operations.check_out'));
create policy custody_item_returns_view on public.custody_item_returns for select to authenticated using(exists(select 1 from public.check_out_records c join public.operational_visits ov on ov.business_id=c.business_id and ov.id=c.operational_visit_id where c.business_id=custody_item_returns.business_id and c.id=custody_item_returns.check_out_record_id and app.member_has_permission(c.business_id,'operations.check_out') and app.member_can_access_location(ov.business_id,ov.location_id)));
create policy resource_turnover_tasks_view on public.resource_turnover_tasks for select to authenticated using(app.member_has_permission(business_id,'operations.check_out') and app.member_can_access_location(business_id,location_id));
revoke all on function app.record_checkout_override(uuid,uuid,text,text,text),app.complete_pet_checkout(uuid,uuid,text,text,text,jsonb,jsonb,text,boolean,text) from public;
grant execute on function app.record_checkout_override(uuid,uuid,text,text,text),app.complete_pet_checkout(uuid,uuid,text,text,text,jsonb,jsonb,text,boolean,text) to authenticated;
