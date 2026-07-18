-- PetCare E11 resource cleaning, inspection, and readiness execution.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.clean_resources','Perform documented resource cleaning and sanitation.','standard'),
 ('operations.inspect_resources','Inspect cleaned resources and release them for assignment.','sensitive')
on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.clean_resources'),('manager','operations.clean_resources'),('care_staff','operations.clean_resources'),
 ('owner','operations.inspect_resources'),('manager','operations.inspect_resources')
on conflict do nothing;

alter table public.resource_turnover_tasks
 add column cleaning_started_by uuid references auth.users(id) on delete restrict,
 add column cleaning_started_at timestamptz,
 add column cleaning_completed_by uuid references auth.users(id) on delete restrict,
 add column cleaning_completed_at timestamptz,
 add column cleaning_checklist jsonb,
 add column protocol_reference text,
 add column cleaning_notes text,
 add column inspected_by uuid references auth.users(id) on delete restrict,
 add column inspected_at timestamptz,
 add column inspection_checklist jsonb,
 add column inspection_notes text,
 add column failed_at timestamptz,
 add column failure_reason text,
 add constraint turnover_cleaning_checklist_object check(cleaning_checklist is null or jsonb_typeof(cleaning_checklist)='object'),
 add constraint turnover_inspection_checklist_object check(inspection_checklist is null or jsonb_typeof(inspection_checklist)='object');

create table public.resource_turnover_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,resource_turnover_task_id uuid not null,
 event_type text not null check(event_type in('cleaning_started','cleaning_completed','inspection_passed','inspection_failed')),
 prior_status text not null,new_status text not null,details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
 actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,resource_turnover_task_id) references public.resource_turnover_tasks(business_id,id) on delete restrict
);
create index resource_turnover_events_task_idx on public.resource_turnover_events(business_id,resource_turnover_task_id,occurred_at);
create trigger resource_turnover_events_immutable before update or delete on public.resource_turnover_events for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.start_resource_turnover(target_business_id uuid,target_task_id uuid,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$declare task public.resource_turnover_tasks%rowtype;event_id uuid;begin
 if not app.member_has_permission(target_business_id,'operations.clean_resources') then raise exception 'resource cleaning unavailable' using errcode='42501';end if;
 select id into event_id from public.resource_turnover_events where business_id=target_business_id and idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into task from public.resource_turnover_tasks where business_id=target_business_id and id=target_task_id and app.member_can_access_location(business_id,location_id) for update;
 if task.id is null or task.status<>'cleaning_required' then raise exception 'turnover is not ready to start' using errcode='P0002';end if;
 update public.resource_turnover_tasks set status='cleaning',cleaning_started_by=auth.uid(),cleaning_started_at=now(),failed_at=null,failure_reason=null where id=task.id;
 insert into public.resource_turnover_events(business_id,resource_turnover_task_id,event_type,prior_status,new_status,idempotency_key) values(target_business_id,task.id,'cleaning_started',task.status,'cleaning',trim(request_key)) returning id into event_id;return event_id;
end;$$;

create or replace function app.complete_resource_cleaning(target_business_id uuid,target_task_id uuid,checklist_value jsonb,protocol_value text,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$declare task public.resource_turnover_tasks%rowtype;event_id uuid;required_key text;begin
 if not app.member_has_permission(target_business_id,'operations.clean_resources') then raise exception 'resource cleaning unavailable' using errcode='42501';end if;
 select id into event_id from public.resource_turnover_events where business_id=target_business_id and idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into task from public.resource_turnover_tasks where business_id=target_business_id and id=target_task_id and app.member_can_access_location(business_id,location_id) for update;
 if task.id is null or task.status<>'cleaning' then raise exception 'turnover cleaning is not active' using errcode='P0002';end if;
 if jsonb_typeof(checklist_value)<>'object' or char_length(trim(coalesce(protocol_value,'')))<3 then raise exception 'cleaning checklist and protocol required' using errcode='22023';end if;
 foreach required_key in array array['debris_removed','washed','disinfected','dry','setup_reset'] loop if coalesce((checklist_value->>required_key)::boolean,false) is not true then raise exception 'required cleaning checklist incomplete' using errcode='22023';end if;end loop;
 update public.resource_turnover_tasks set status='inspection_required',cleaning_completed_by=auth.uid(),cleaning_completed_at=now(),cleaning_checklist=checklist_value,protocol_reference=trim(protocol_value),cleaning_notes=nullif(trim(notes_value),'') where id=task.id;
 insert into public.resource_turnover_events(business_id,resource_turnover_task_id,event_type,prior_status,new_status,details,idempotency_key) values(target_business_id,task.id,'cleaning_completed',task.status,'inspection_required',jsonb_build_object('checklist',checklist_value,'protocol_reference',trim(protocol_value)),trim(request_key)) returning id into event_id;return event_id;
end;$$;

create or replace function app.inspect_resource_turnover(target_business_id uuid,target_task_id uuid,passed_value boolean,checklist_value jsonb,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$declare task public.resource_turnover_tasks%rowtype;event_id uuid;next_status text;event_value text;required_key text;begin
 if not app.member_has_permission(target_business_id,'operations.inspect_resources') then raise exception 'resource inspection unavailable' using errcode='42501';end if;
 select id into event_id from public.resource_turnover_events where business_id=target_business_id and idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into task from public.resource_turnover_tasks where business_id=target_business_id and id=target_task_id and app.member_can_access_location(business_id,location_id) for update;
 if task.id is null or task.status<>'inspection_required' then raise exception 'turnover is not ready for inspection' using errcode='P0002';end if;
 if jsonb_typeof(checklist_value)<>'object' or char_length(trim(coalesce(notes_value,'')))<3 then raise exception 'inspection checklist and notes required' using errcode='22023';end if;
 foreach required_key in array array['visibly_clean','dry','odor_free','safe','setup_correct'] loop if not (checklist_value ? required_key) then raise exception 'inspection checklist incomplete' using errcode='22023';end if;end loop;
 if passed_value and exists(select 1 from jsonb_each_text(checklist_value) c where c.value::boolean is false) then raise exception 'failed inspection item cannot pass' using errcode='22023';end if;
 next_status:=case when passed_value then 'ready' else 'cleaning_required' end;event_value:=case when passed_value then 'inspection_passed' else 'inspection_failed' end;
 update public.resource_turnover_tasks set status=next_status,inspected_by=auth.uid(),inspected_at=now(),inspection_checklist=checklist_value,inspection_notes=trim(notes_value),completed_at=case when passed_value then now() else null end,failed_at=case when passed_value then null else now() end,failure_reason=case when passed_value then null else trim(notes_value) end where id=task.id;
 update public.capacity_resources set status=case when passed_value then 'ready' else 'cleaning' end where business_id=target_business_id and id=task.capacity_resource_id;
 insert into public.resource_turnover_events(business_id,resource_turnover_task_id,event_type,prior_status,new_status,details,idempotency_key) values(target_business_id,task.id,event_value,task.status,next_status,jsonb_build_object('checklist',checklist_value,'notes',trim(notes_value)),trim(request_key)) returning id into event_id;return event_id;
end;$$;

alter table public.resource_turnover_events enable row level security;alter table public.resource_turnover_events force row level security;
revoke all on public.resource_turnover_events from anon,authenticated;grant select on public.resource_turnover_events to authenticated;
create policy resource_turnover_events_view on public.resource_turnover_events for select to authenticated using(exists(select 1 from public.resource_turnover_tasks t where t.business_id=resource_turnover_events.business_id and t.id=resource_turnover_events.resource_turnover_task_id and (app.member_has_permission(t.business_id,'operations.clean_resources') or app.member_has_permission(t.business_id,'operations.inspect_resources')) and app.member_can_access_location(t.business_id,t.location_id)));
revoke all on function app.start_resource_turnover(uuid,uuid,text),app.complete_resource_cleaning(uuid,uuid,jsonb,text,text,text),app.inspect_resource_turnover(uuid,uuid,boolean,jsonb,text,text) from public;
grant execute on function app.start_resource_turnover(uuid,uuid,text),app.complete_resource_cleaning(uuid,uuid,jsonb,text,text,text),app.inspect_resource_turnover(uuid,uuid,boolean,jsonb,text,text) to authenticated;
