-- PetCare E09 controlled blocker resolution and visit-only care amendments.
create table public.check_in_blocker_resolutions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_id uuid not null,booking_action_item_id uuid not null,
 resolution_type text not null check(resolution_type in('requirement_satisfied','approved_exception')),
 reason text not null check(char_length(trim(reason)) between 12 and 1000),evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 resolved_by uuid not null references auth.users(id) on delete restrict default auth.uid(),resolved_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,booking_action_item_id),unique(business_id,idempotency_key),
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
 foreign key(business_id,booking_action_item_id) references public.booking_action_items(business_id,id) on delete restrict
);

create table public.care_plan_amendments(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,care_plan_snapshot_id uuid not null,
 category text not null check(category in('feeding','medication','allergy','health','behavior','general')),
 amendment jsonb not null check(jsonb_typeof(amendment)='object'),reason text not null check(char_length(trim(reason)) between 8 and 1000),
 master_update_status text not null default 'not_requested' check(master_update_status in('not_requested','proposed','accepted','declined')),
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,care_plan_snapshot_id) references public.care_plan_snapshots(business_id,id) on delete restrict
);
create index care_plan_amendments_visit_idx on public.care_plan_amendments(business_id,pet_visit_id,created_at);

create trigger check_in_blocker_resolutions_immutable before update or delete on public.check_in_blocker_resolutions for each row execute function app.prevent_commercial_snapshot_change();
create trigger care_plan_amendments_immutable before update or delete on public.care_plan_amendments for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.resolve_check_in_blocker(
 target_business_id uuid,target_action_id uuid,resolution_value text,reason_value text,evidence_value jsonb,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare action_record public.booking_action_items%rowtype;created_id uuid;has_manager_role boolean;
begin
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id
  where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into has_manager_role;
 if not has_manager_role or not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'manager resolution unavailable' using errcode='42501';end if;
 select id into created_id from public.check_in_blocker_resolutions where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select a.* into action_record from public.booking_action_items a join public.bookings b on b.business_id=a.business_id and b.id=a.booking_id
 where a.business_id=target_business_id and a.id=target_action_id and a.status='open' and a.blocking and app.member_can_access_location(b.business_id,b.location_id) for update of a;
 if action_record.id is null then raise exception 'open check-in blocker unavailable' using errcode='P0002';end if;
 if resolution_value not in('requirement_satisfied','approved_exception') or char_length(trim(coalesce(reason_value,'')))<12 or jsonb_typeof(coalesce(evidence_value,'{}'))<>'object' then raise exception 'documented resolution required' using errcode='22023';end if;
 if action_record.action_type in('eligibility_review','deposit','approval') then raise exception 'this blocker must be resolved by its authoritative workflow' using errcode='P0001';end if;
 if resolution_value='approved_exception' and coalesce((action_record.metadata->>'overrideable')::boolean,false)=false then raise exception 'this blocker is not overrideable' using errcode='P0001';end if;
 insert into public.check_in_blocker_resolutions(business_id,booking_id,booking_action_item_id,resolution_type,reason,evidence,idempotency_key)
 values(target_business_id,action_record.booking_id,action_record.id,resolution_value,trim(reason_value),coalesce(evidence_value,'{}'),trim(request_key)) returning id into created_id;
 update public.booking_action_items set status='resolved',resolved_by=auth.uid(),resolved_at=now() where id=action_record.id;
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id)
 values(target_business_id,action_record.booking_id,'operations.check_in_blocker_resolved',false,'Manager resolved a check-in blocker.',jsonb_build_object('action_id',action_record.id,'resolution_id',created_id,'resolution_type',resolution_value),auth.uid());
 return created_id;
end;$$;

create or replace function app.add_visit_care_amendment(
 target_business_id uuid,target_pet_visit_id uuid,category_value text,amendment_value jsonb,reason_value text,propose_master_update boolean,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;snapshot_id uuid;created_id uuid;has_manager_role boolean;
begin
 if not app.member_has_permission(target_business_id,'operations.check_in') then raise exception 'care amendment unavailable' using errcode='42501';end if;
 select id into created_id from public.care_plan_amendments where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select p.* into pv from public.pet_visits p join public.operational_visits v on v.business_id=p.business_id and v.id=p.operational_visit_id
 where p.business_id=target_business_id and p.id=target_pet_visit_id and p.status='in_care' and app.member_can_access_location(v.business_id,v.location_id);
 select id into snapshot_id from public.care_plan_snapshots where business_id=target_business_id and pet_visit_id=pv.id;
 if pv.id is null or snapshot_id is null then raise exception 'active care plan unavailable' using errcode='P0002';end if;
 if category_value not in('feeding','medication','allergy','health','behavior','general') or jsonb_typeof(coalesce(amendment_value,'{}'))<>'object' or amendment_value='{}' or char_length(trim(coalesce(reason_value,'')))<8 then raise exception 'structured care amendment required' using errcode='22023';end if;
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into has_manager_role;
 if category_value in('medication','allergy','health') and not has_manager_role then raise exception 'manager review required for safety-critical amendment' using errcode='42501';end if;
 insert into public.care_plan_amendments(business_id,operational_visit_id,pet_visit_id,care_plan_snapshot_id,category,amendment,reason,master_update_status,idempotency_key)
 values(target_business_id,pv.operational_visit_id,pv.id,snapshot_id,category_value,amendment_value,trim(reason_value),case when propose_master_update then 'proposed' else 'not_requested' end,trim(request_key)) returning id into created_id;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id)
 values(target_business_id,pv.operational_visit_id,pv.id,'care_plan_amended','Visit-only care instructions were amended.',jsonb_build_object('amendment_id',created_id,'category',category_value,'master_update_proposed',propose_master_update),auth.uid());
 return created_id;
end;$$;

do $$declare n text;begin foreach n in array array['check_in_blocker_resolutions','care_plan_amendments'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);end loop;end$$;
create policy check_in_blocker_resolutions_view on public.check_in_blocker_resolutions for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.bookings b where b.business_id=check_in_blocker_resolutions.business_id and b.id=check_in_blocker_resolutions.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy care_plan_amendments_view on public.care_plan_amendments for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=care_plan_amendments.business_id and v.id=care_plan_amendments.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
revoke all on function app.resolve_check_in_blocker(uuid,uuid,text,text,jsonb,text),app.add_visit_care_amendment(uuid,uuid,text,jsonb,text,boolean,text) from public;
grant execute on function app.resolve_check_in_blocker(uuid,uuid,text,text,jsonb,text),app.add_visit_care_amendment(uuid,uuid,text,jsonb,text,boolean,text) to authenticated;
