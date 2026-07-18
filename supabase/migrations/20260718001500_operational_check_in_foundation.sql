-- PetCare E09 operational arrival and check-in foundation.
create table public.operational_visits(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,booking_id uuid not null,
 status text not null default 'expected' check(status in('expected','arrived','in_care','checked_out','completed','cancelled')),
 scheduled_start timestamptz not null,scheduled_end timestamptz not null,arrived_at timestamptz,arrived_by uuid references auth.users(id) on delete restrict,
 checked_in_at timestamptz,checked_in_by uuid references auth.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,booking_id),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,check(scheduled_end>scheduled_start)
);
create index operational_visits_arrivals_idx on public.operational_visits(business_id,location_id,scheduled_start,status);

create table public.pet_visits(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,booking_item_id uuid not null,pet_id uuid not null,
 status text not null default 'expected' check(status in('expected','arrived','in_care','checked_out','completed','cancelled')),
 arrived_at timestamptz,checked_in_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,booking_item_id),foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,booking_item_id) references public.booking_items(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict
);
create index pet_visits_active_idx on public.pet_visits(business_id,pet_id,status);

create table public.check_in_records(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,
 presenter_name text not null check(char_length(trim(presenter_name)) between 2 and 160),presenter_relationship text not null check(presenter_relationship in('owner','household_member','authorized_pickup','other')),
 verification_method text not null check(verification_method in('photo_id','account_questions','known_customer','other')),
 verified_identifiers jsonb not null check(jsonb_typeof(verified_identifiers)='array' and jsonb_array_length(verified_identifiers)>=2),
 arrival_condition jsonb not null check(jsonb_typeof(arrival_condition)='object'),blocker_snapshot jsonb not null check(jsonb_typeof(blocker_snapshot)='array'),
 idempotency_key text not null,completed_by uuid not null references auth.users(id) on delete restrict default auth.uid(),completed_at timestamptz not null default now(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,pet_visit_id),unique(business_id,idempotency_key),
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict
);

create table public.care_plan_snapshots(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),captured_by uuid not null references auth.users(id) on delete restrict default auth.uid(),captured_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,pet_visit_id),foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict
);

create table public.visit_custody_items(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,
 category text not null check(category in('belonging','food','medication')),item_name text not null check(char_length(trim(item_name)) between 1 and 200),
 quantity numeric(10,2) not null default 1 check(quantity>0),unit text not null default 'item' check(char_length(trim(unit)) between 1 and 40),
 condition_notes text,storage_location text,return_expected boolean not null default true,accepted_by uuid not null references auth.users(id) on delete restrict default auth.uid(),accepted_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict
);

create table public.operational_timeline_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid,
 event_type text not null,summary text not null,details jsonb not null check(jsonb_typeof(details)='object'),actor_id uuid references auth.users(id) on delete restrict,occurred_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict
);
create index operational_timeline_idx on public.operational_timeline_events(business_id,operational_visit_id,occurred_at);

create trigger operational_visits_updated before update on public.operational_visits for each row execute function app.set_updated_at();
create trigger pet_visits_updated before update on public.pet_visits for each row execute function app.set_updated_at();
create trigger operational_visits_tenant before update on public.operational_visits for each row execute function app.prevent_business_id_change();
create trigger pet_visits_tenant before update on public.pet_visits for each row execute function app.prevent_business_id_change();
create trigger check_in_records_immutable before update or delete on public.check_in_records for each row execute function app.prevent_commercial_snapshot_change();
create trigger care_snapshots_immutable before update or delete on public.care_plan_snapshots for each row execute function app.prevent_commercial_snapshot_change();
create trigger custody_items_immutable before update or delete on public.visit_custody_items for each row execute function app.prevent_commercial_snapshot_change();
create trigger operational_timeline_immutable before update or delete on public.operational_timeline_events for each row execute function app.prevent_commercial_snapshot_change();
create trigger operational_visits_audit after insert or update or delete on public.operational_visits for each row execute function app.audit_configuration_change('operations.visit.changed','operational_visit');

create or replace function app.record_booking_arrival(target_business_id uuid,target_booking_id uuid,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.operational_visits%rowtype;b public.bookings%rowtype;
begin
 if not app.member_has_permission(target_business_id,'operations.check_in') then raise exception 'arrival unavailable' using errcode='42501';end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id for update;
 if b.id is null or b.status<>'confirmed' or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'confirmed booking unavailable' using errcode='P0002';end if;
 select * into v from public.operational_visits where business_id=target_business_id and booking_id=b.id for update;
 if v.id is null then
  insert into public.operational_visits(business_id,location_id,booking_id,scheduled_start,scheduled_end)
  select b.business_id,b.location_id,b.id,min(i.starts_at),max(i.ends_at) from public.booking_items i where i.business_id=b.business_id and i.booking_id=b.id and i.status='confirmed'
  group by b.business_id,b.location_id,b.id returning * into v;
  if v.id is null then raise exception 'confirmed booking items unavailable' using errcode='P0002';end if;
  insert into public.pet_visits(business_id,operational_visit_id,booking_item_id,pet_id)
  select i.business_id,v.id,i.id,i.pet_id from public.booking_items i where i.business_id=b.business_id and i.booking_id=b.id and i.status='confirmed' on conflict do nothing;
 end if;
 if v.status='expected' then
  update public.operational_visits set status='arrived',arrived_at=now(),arrived_by=auth.uid() where id=v.id returning * into v;
  update public.pet_visits set status='arrived',arrived_at=v.arrived_at where business_id=target_business_id and operational_visit_id=v.id and status='expected';
  insert into public.operational_timeline_events(business_id,operational_visit_id,event_type,summary,details,actor_id)
  values(target_business_id,v.id,'arrival_recorded','Customer and pets arrived at the facility.',jsonb_build_object('request_key',request_key),auth.uid());
 end if;
 return v.id;
end;$$;

create or replace function app.complete_pet_check_in(
 target_business_id uuid,target_booking_id uuid,target_pet_id uuid,presenter_value text,relationship_value text,verification_value text,
 identifiers_value jsonb,condition_value jsonb,custody_value jsonb,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.operational_visits%rowtype;pv public.pet_visits%rowtype;created_id uuid;item jsonb;eligibility record;snapshot_value jsonb;blocking_count integer;
begin
 if not app.member_has_permission(target_business_id,'operations.check_in') then raise exception 'check-in unavailable' using errcode='42501';end if;
 if jsonb_typeof(identifiers_value)<>'array' or jsonb_array_length(identifiers_value)<2 or
   (select count(distinct trim(value)) from jsonb_array_elements_text(identifiers_value))<2 then raise exception 'two pet identifiers are required' using errcode='22023';end if;
 if jsonb_typeof(coalesce(condition_value,'{}'))<>'object' or jsonb_typeof(coalesce(custody_value,'[]'))<>'array' then raise exception 'invalid intake details' using errcode='22023';end if;
 select * into v from public.operational_visits where business_id=target_business_id and booking_id=target_booking_id for update;
 if v.id is null or v.status not in('arrived','in_care') then raise exception 'record arrival before check-in' using errcode='P0001';end if;
 select p.* into pv from public.pet_visits p join public.booking_items i on i.business_id=p.business_id and i.id=p.booking_item_id
 where p.business_id=target_business_id and p.operational_visit_id=v.id and p.pet_id=target_pet_id and i.booking_id=target_booking_id for update;
 if pv.id is null then raise exception 'pet visit unavailable' using errcode='P0002';end if;
 select id into created_id from public.check_in_records where business_id=target_business_id and idempotency_key=request_key;
 if created_id is not null then return created_id;end if;
 select count(*) into blocking_count from public.booking_action_items where business_id=target_business_id and booking_id=target_booking_id and blocking and status='open';
 if blocking_count>0 then raise exception 'blocking booking actions remain open' using errcode='P0001';end if;
 select * into eligibility from app.evaluate_pet_service_eligibility(target_business_id,target_pet_id,
  (select i.service_version_id from public.booking_items i where i.business_id=target_business_id and i.id=pv.booking_item_id),v.scheduled_start::date);
 if not coalesce(eligibility.eligible,false) then raise exception 'pet is not eligible for this service' using errcode='P0001';end if;
 snapshot_value:=jsonb_build_object(
  'schema_version',1,'pet',(select to_jsonb(p) from public.pets p where p.business_id=target_business_id and p.id=target_pet_id),
  'allergies',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.pet_allergies a where a.business_id=target_business_id and a.pet_id=target_pet_id and a.status='active'),'[]'::jsonb),
  'medications',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.pet_medication_plans m where m.business_id=target_business_id and m.pet_id=target_pet_id and m.status='active'),'[]'::jsonb),
  'feeding',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.pet_feeding_plans f where f.business_id=target_business_id and f.pet_id=target_pet_id and f.status='active'),'[]'::jsonb),
  'behavior',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.pet_behavior_records r where r.business_id=target_business_id and r.pet_id=target_pet_id and r.status='active'),'[]'::jsonb),
  'health',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at) from public.pet_health_conditions h where h.business_id=target_business_id and h.pet_id=target_pet_id and h.status='active'),'[]'::jsonb));
 insert into public.care_plan_snapshots(business_id,operational_visit_id,pet_visit_id,pet_id,snapshot) values(target_business_id,v.id,pv.id,target_pet_id,snapshot_value);
 insert into public.check_in_records(business_id,operational_visit_id,pet_visit_id,presenter_name,presenter_relationship,verification_method,verified_identifiers,arrival_condition,blocker_snapshot,idempotency_key)
 values(target_business_id,v.id,pv.id,trim(presenter_value),relationship_value,verification_value,identifiers_value,coalesce(condition_value,'{}'), '[]',request_key) returning id into created_id;
 for item in select value from jsonb_array_elements(coalesce(custody_value,'[]')) loop
  insert into public.visit_custody_items(business_id,operational_visit_id,pet_visit_id,category,item_name,quantity,unit,condition_notes,storage_location,return_expected)
  values(target_business_id,v.id,pv.id,item->>'category',item->>'name',coalesce((item->>'quantity')::numeric,1),coalesce(nullif(item->>'unit',''),'item'),item->>'condition',item->>'storage',coalesce((item->>'return_expected')::boolean,true));
 end loop;
 update public.pet_visits set status='in_care',checked_in_at=now() where id=pv.id;
 if not exists(select 1 from public.pet_visits where business_id=target_business_id and operational_visit_id=v.id and status<>'in_care') then
  update public.operational_visits set status='in_care',checked_in_at=now(),checked_in_by=auth.uid() where id=v.id;
 end if;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id)
 values(target_business_id,v.id,pv.id,'pet_checked_in','Pet identity, care plan, condition, and custody were accepted.',jsonb_build_object('check_in_record_id',created_id),auth.uid());
 return created_id;
end;$$;

do $$declare n text;begin foreach n in array array['operational_visits','pet_visits','check_in_records','care_plan_snapshots','visit_custody_items','operational_timeline_events'] loop
 execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);
 execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);
end loop;end$$;
create policy operational_visits_view on public.operational_visits for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and app.member_can_access_location(business_id,location_id));
create policy pet_visits_view on public.pet_visits for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=pet_visits.business_id and v.id=pet_visits.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
create policy check_in_records_view on public.check_in_records for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=check_in_records.business_id and v.id=check_in_records.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
create policy care_plan_snapshots_view on public.care_plan_snapshots for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=care_plan_snapshots.business_id and v.id=care_plan_snapshots.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
create policy visit_custody_items_view on public.visit_custody_items for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=visit_custody_items.business_id and v.id=visit_custody_items.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
create policy operational_timeline_events_view on public.operational_timeline_events for select to authenticated using(app.member_has_permission(business_id,'operations.check_in') and exists(select 1 from public.operational_visits v where v.business_id=operational_timeline_events.business_id and v.id=operational_timeline_events.operational_visit_id and app.member_can_access_location(v.business_id,v.location_id)));
revoke all on function app.record_booking_arrival(uuid,uuid,text),app.complete_pet_check_in(uuid,uuid,uuid,text,text,text,jsonb,jsonb,jsonb,text) from public;
grant execute on function app.record_booking_arrival(uuid,uuid,text),app.complete_pet_check_in(uuid,uuid,uuid,text,text,text,jsonb,jsonb,jsonb,text) to authenticated;
