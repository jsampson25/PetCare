-- PetCare E10 category-specific boarding, daycare, and grooming execution.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.execute_service','Progress boarding, daycare, and grooming service work.','standard') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.execute_service'),('manager','operations.execute_service'),('care_staff','operations.execute_service'),('groomer','operations.execute_service') on conflict do nothing;

create table public.service_executions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,booking_item_id uuid not null,pet_id uuid not null,service_version_id uuid not null,
 service_category text not null check(service_category in('boarding','daycare','grooming')),stage text not null,
 assigned_staff_id uuid references auth.users(id) on delete restrict,started_at timestamptz,ready_at timestamptz,completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,booking_item_id),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,booking_item_id) references public.booking_items(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 foreign key(business_id,service_version_id) references public.service_versions(business_id,id) on delete restrict,
 check((service_category='boarding' and stage in('settling','active','departure_preparation','ready','completed','hold')) or
       (service_category='daycare' and stage in('attendance','evaluation','playgroup','resting','one_on_one','ready','completed','hold')) or
       (service_category='grooming' and stage in('intake','bathing','processing','drying','finishing','quality_review','ready','completed','hold'))),
 check(ready_at is null or started_at is not null),check(completed_at is null or ready_at is not null)
);
create index service_executions_board_idx on public.service_executions(business_id,location_id,service_category,stage,updated_at);
create trigger service_executions_updated before update on public.service_executions for each row execute function app.set_updated_at();
create trigger service_executions_tenant before update on public.service_executions for each row execute function app.prevent_business_id_change();
create trigger service_executions_audit after insert or update or delete on public.service_executions for each row execute function app.audit_configuration_change('operations.service_execution.changed','service_execution');

create table public.service_execution_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,service_execution_id uuid not null,from_stage text,to_stage text not null,
 notes text,details jsonb not null default '{}' check(jsonb_typeof(details)='object'),actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict
);
create index service_execution_events_history_idx on public.service_execution_events(business_id,service_execution_id,occurred_at);
create trigger service_execution_events_immutable before update or delete on public.service_execution_events for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.initialize_service_execution(target_business_id uuid,target_pet_visit_id uuid,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;v public.operational_visits%rowtype;i public.booking_items%rowtype;category_value text;stage_value text;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'operations.execute_service') then raise exception 'service execution unavailable' using errcode='42501';end if;
 select id into created_id from public.service_executions where business_id=target_business_id and pet_visit_id=target_pet_visit_id;if created_id is not null then return created_id;end if;
 select * into pv from public.pet_visits where business_id=target_business_id and id=target_pet_visit_id and status='in_care' and handoff_status='accepted' for update;
 select * into v from public.operational_visits where business_id=target_business_id and id=pv.operational_visit_id;
 select * into i from public.booking_items where business_id=target_business_id and id=pv.booking_item_id;
 select s.category into category_value from public.service_versions sv join public.services s on s.business_id=sv.business_id and s.id=sv.service_id where sv.business_id=target_business_id and sv.id=i.service_version_id;
 if pv.id is null or not app.member_can_access_location(target_business_id,v.location_id) or category_value not in('boarding','daycare','grooming') then raise exception 'active service unavailable' using errcode='P0002';end if;
 stage_value:=case category_value when 'boarding' then 'settling' when 'daycare' then 'attendance' else 'intake' end;
 insert into public.service_executions(business_id,location_id,operational_visit_id,pet_visit_id,booking_item_id,pet_id,service_version_id,service_category,stage,assigned_staff_id,started_at)
 values(target_business_id,v.location_id,v.id,pv.id,i.id,pv.pet_id,i.service_version_id,category_value,stage_value,auth.uid(),now()) returning id into created_id;
 insert into public.service_execution_events(business_id,service_execution_id,to_stage,notes,idempotency_key) values(target_business_id,created_id,stage_value,'Execution initialized after custody handoff.',trim(request_key));
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,v.id,pv.id,'service_execution_started',initcap(category_value)||' execution started.',jsonb_build_object('service_execution_id',created_id,'stage',stage_value),auth.uid());
 return created_id;
end;$$;

create or replace function app.transition_service_execution(target_business_id uuid,target_execution_id uuid,next_stage text,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.service_executions%rowtype;created_id uuid;allowed boolean:=false;
begin
 if not app.member_has_permission(target_business_id,'operations.execute_service') then raise exception 'service transition unavailable' using errcode='42501';end if;
 select id into created_id from public.service_execution_events where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and app.member_can_access_location(business_id,location_id) for update;
 allowed:=case e.service_category
  when 'boarding' then (e.stage,next_stage) in(('settling','active'),('settling','hold'),('active','departure_preparation'),('active','hold'),('departure_preparation','ready'),('departure_preparation','hold'),('ready','completed'),('hold','active'),('hold','departure_preparation'))
  when 'daycare' then (e.stage,next_stage) in(('attendance','evaluation'),('attendance','playgroup'),('attendance','one_on_one'),('evaluation','playgroup'),('evaluation','one_on_one'),('playgroup','resting'),('playgroup','ready'),('playgroup','hold'),('resting','playgroup'),('resting','ready'),('one_on_one','resting'),('one_on_one','ready'),('hold','one_on_one'),('hold','ready'),('ready','completed'))
  when 'grooming' then (e.stage,next_stage) in(('intake','bathing'),('intake','processing'),('intake','hold'),('bathing','processing'),('bathing','drying'),('processing','drying'),('processing','finishing'),('drying','finishing'),('finishing','quality_review'),('quality_review','finishing'),('quality_review','ready'),('hold','intake'),('hold','processing'),('ready','completed')) else false end;
 if e.id is null or not allowed or (next_stage in('hold','ready','completed') and char_length(trim(coalesce(notes_value,'')))<5) then raise exception 'invalid documented service transition' using errcode='22023';end if;
 update public.service_executions set stage=next_stage,ready_at=case when next_stage='ready' then now() else ready_at end,completed_at=case when next_stage='completed' then now() else completed_at end where id=e.id;
 insert into public.service_execution_events(business_id,service_execution_id,from_stage,to_stage,notes,idempotency_key) values(target_business_id,e.id,e.stage,next_stage,nullif(trim(notes_value),''),trim(request_key)) returning id into created_id;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,e.operational_visit_id,e.pet_visit_id,'service_stage_changed',initcap(e.service_category)||' moved from '||replace(e.stage,'_',' ')||' to '||replace(next_stage,'_',' ')||'.',jsonb_build_object('service_execution_id',e.id,'from_stage',e.stage,'to_stage',next_stage),auth.uid());
 return created_id;
end;$$;

alter table public.service_executions enable row level security;alter table public.service_executions force row level security;
alter table public.service_execution_events enable row level security;alter table public.service_execution_events force row level security;
revoke all on public.service_executions,public.service_execution_events from anon,authenticated;grant select on public.service_executions,public.service_execution_events to authenticated;
create policy service_executions_view on public.service_executions for select to authenticated using(app.member_has_permission(business_id,'operations.execute_service') and app.member_can_access_location(business_id,location_id));
create policy service_execution_events_view on public.service_execution_events for select to authenticated using(exists(select 1 from public.service_executions e where e.business_id=service_execution_events.business_id and e.id=service_execution_events.service_execution_id and app.member_has_permission(e.business_id,'operations.execute_service') and app.member_can_access_location(e.business_id,e.location_id)));
revoke all on function app.initialize_service_execution(uuid,uuid,text),app.transition_service_execution(uuid,uuid,text,text,text) from public;
grant execute on function app.initialize_service_execution(uuid,uuid,text),app.transition_service_execution(uuid,uuid,text,text,text) to authenticated;
