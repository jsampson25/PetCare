-- PetCare E10 snapshot-bound feeding and medication work foundation.
create table public.care_tasks(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,care_plan_snapshot_id uuid not null,
 task_type text not null check(task_type in('feeding','medication')),title text not null check(char_length(trim(title)) between 2 and 200),instructions jsonb not null check(jsonb_typeof(instructions)='object'),
 due_starts_at timestamptz not null,due_ends_at timestamptz not null,priority text not null default 'routine' check(priority in('routine','urgent','critical')),
 status text not null default 'scheduled' check(status in('scheduled','in_progress','completed','partial','refused','held','missed','unable','adverse','cancelled')),
 source_record_id uuid,assigned_role text not null,started_by uuid references auth.users(id) on delete restrict,started_at timestamptz,
 completed_by uuid references auth.users(id) on delete restrict,completed_at timestamptz,idempotency_key text not null,created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,foreign key(business_id,care_plan_snapshot_id) references public.care_plan_snapshots(business_id,id) on delete restrict,
 check(due_ends_at>due_starts_at),check((started_at is null)=(started_by is null)),check((completed_at is null)=(completed_by is null))
);
create index care_tasks_work_queue_idx on public.care_tasks(business_id,location_id,status,due_starts_at,due_ends_at);
create unique index care_tasks_source_window_idx on public.care_tasks(business_id,pet_visit_id,task_type,source_record_id,due_starts_at) where source_record_id is not null and status<>'cancelled';

create table public.care_task_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,care_task_id uuid not null,event_type text not null check(event_type in('scheduled','started','outcome_recorded','corrected','cancelled','escalated')),
 from_status text,to_status text,outcome jsonb not null check(jsonb_typeof(outcome)='object'),reason text,actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,care_task_id) references public.care_tasks(business_id,id) on delete restrict
);
create index care_task_events_history_idx on public.care_task_events(business_id,care_task_id,occurred_at);

create table public.operational_alerts(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,care_task_id uuid,
 severity text not null check(severity in('warning','urgent','critical')),alert_type text not null,status text not null default 'open' check(status in('open','acknowledged','resolved')),
 summary text not null,details jsonb not null check(jsonb_typeof(details)='object'),created_at timestamptz not null default now(),acknowledged_by uuid references auth.users(id) on delete restrict,acknowledged_at timestamptz,
 unique(business_id,id),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,care_task_id) references public.care_tasks(business_id,id) on delete restrict
);
create unique index operational_alert_open_task_idx on public.operational_alerts(business_id,care_task_id,alert_type) where status='open';

create trigger care_tasks_updated before update on public.care_tasks for each row execute function app.set_updated_at();
create trigger care_tasks_tenant before update on public.care_tasks for each row execute function app.prevent_business_id_change();
create trigger care_task_events_immutable before update or delete on public.care_task_events for each row execute function app.prevent_commercial_snapshot_change();
create trigger care_tasks_audit after insert or update or delete on public.care_tasks for each row execute function app.audit_configuration_change('operations.care_task.changed','care_task');

create or replace function app.schedule_snapshot_care_task(
 target_business_id uuid,target_pet_visit_id uuid,task_type_value text,title_value text,instructions_value jsonb,due_start_value timestamptz,due_end_value timestamptz,priority_value text,source_record_value uuid,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;v public.operational_visits%rowtype;snapshot_id uuid;created_id uuid;required_permission text;
begin
 required_permission:=case task_type_value when 'feeding' then 'operations.record_feeding' when 'medication' then 'operations.record_medication' else null end;
 if required_permission is null or not app.member_has_permission(target_business_id,required_permission) then raise exception 'care task scheduling unavailable' using errcode='42501';end if;
 select id into created_id from public.care_tasks where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select p.* into pv from public.pet_visits p join public.operational_visits ov on ov.business_id=p.business_id and ov.id=p.operational_visit_id where p.business_id=target_business_id and p.id=target_pet_visit_id and p.status='in_care' and p.handoff_status='accepted' and app.member_can_access_location(ov.business_id,ov.location_id);
 select * into v from public.operational_visits where business_id=target_business_id and id=pv.operational_visit_id;
 select id into snapshot_id from public.care_plan_snapshots where business_id=target_business_id and pet_visit_id=pv.id;
 if pv.id is null or snapshot_id is null then raise exception 'active handed-off pet unavailable' using errcode='P0002';end if;
 if due_end_value<=due_start_value or due_start_value<v.scheduled_start or due_end_value>v.scheduled_end or priority_value not in('routine','urgent','critical') or jsonb_typeof(coalesce(instructions_value,'{}'))<>'object' or instructions_value='{}' then raise exception 'valid snapshot task and due window required' using errcode='22023';end if;
 insert into public.care_tasks(business_id,location_id,operational_visit_id,pet_visit_id,pet_id,care_plan_snapshot_id,task_type,title,instructions,due_starts_at,due_ends_at,priority,source_record_id,assigned_role,idempotency_key)
 values(target_business_id,v.location_id,v.id,pv.id,pv.pet_id,snapshot_id,task_type_value,trim(title_value),instructions_value,due_start_value,due_end_value,priority_value,source_record_value,case task_type_value when 'medication' then 'medication_authorized' else 'care_staff' end,trim(request_key)) returning id into created_id;
 insert into public.care_task_events(business_id,care_task_id,event_type,to_status,outcome,idempotency_key) values(target_business_id,created_id,'scheduled','scheduled',jsonb_build_object('snapshot_id',snapshot_id),'scheduled-'||created_id::text);
 return created_id;
end;$$;

create or replace function app.start_care_task(target_business_id uuid,target_task_id uuid,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.care_tasks%rowtype;event_id uuid;required_permission text;
begin
 select id into event_id from public.care_task_events where business_id=target_business_id and idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into t from public.care_tasks where business_id=target_business_id and id=target_task_id for update;
 required_permission:=case t.task_type when 'feeding' then 'operations.record_feeding' when 'medication' then 'operations.record_medication' end;
 if t.id is null or not app.member_has_permission(target_business_id,required_permission) or not app.member_can_access_location(target_business_id,t.location_id) then raise exception 'care task unavailable' using errcode='42501';end if;
 if t.status<>'scheduled' then raise exception 'scheduled task unavailable' using errcode='P0001';end if;
 update public.care_tasks set status='in_progress',started_by=auth.uid(),started_at=now() where id=t.id;
 insert into public.care_task_events(business_id,care_task_id,event_type,from_status,to_status,outcome,idempotency_key) values(target_business_id,t.id,'started','scheduled','in_progress','{}',trim(request_key)) returning id into event_id;return event_id;
end;$$;

create or replace function app.record_care_task_outcome(target_business_id uuid,target_task_id uuid,outcome_value text,details_value jsonb,identity_confirmed boolean,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.care_tasks%rowtype;event_id uuid;required_permission text;allowed boolean;alert_severity text;
begin
 select id into event_id from public.care_task_events where business_id=target_business_id and idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into t from public.care_tasks where business_id=target_business_id and id=target_task_id for update;
 required_permission:=case t.task_type when 'feeding' then 'operations.record_feeding' when 'medication' then 'operations.record_medication' end;
 if t.id is null or not app.member_has_permission(target_business_id,required_permission) or not app.member_can_access_location(target_business_id,t.location_id) then raise exception 'care task unavailable' using errcode='42501';end if;
 allowed:=case t.task_type when 'feeding' then outcome_value in('completed','partial','refused','unable') when 'medication' then outcome_value in('completed','partial','refused','held','missed','unable','adverse') else false end;
 if t.status not in('scheduled','in_progress') or not allowed or not coalesce(identity_confirmed,false) or jsonb_typeof(coalesce(details_value,'{}'))<>'object' or details_value='{}' then raise exception 'structured task outcome and pet verification required' using errcode='22023';end if;
 if outcome_value not in('completed') and char_length(trim(coalesce(reason_value,'')))<8 then raise exception 'exception reason required' using errcode='22023';end if;
 if t.task_type='medication' and not coalesce((details_value->>'five_rights_confirmed')::boolean,false) then raise exception 'medication verification required' using errcode='22023';end if;
 update public.care_tasks set status=outcome_value,started_by=coalesce(started_by,auth.uid()),started_at=coalesce(started_at,now()),completed_by=auth.uid(),completed_at=now() where id=t.id;
 insert into public.care_task_events(business_id,care_task_id,event_type,from_status,to_status,outcome,reason,idempotency_key) values(target_business_id,t.id,'outcome_recorded',t.status,outcome_value,details_value,nullif(trim(reason_value),''),trim(request_key)) returning id into event_id;
 if outcome_value in('refused','missed','unable','adverse') then
  alert_severity:=case when t.task_type='medication' or outcome_value='adverse' then 'critical' else 'urgent' end;
  insert into public.operational_alerts(business_id,location_id,operational_visit_id,pet_visit_id,care_task_id,severity,alert_type,summary,details)
  values(target_business_id,t.location_id,t.operational_visit_id,t.pet_visit_id,t.id,alert_severity,t.task_type||'_'||outcome_value,initcap(t.task_type)||' task requires follow-up.',jsonb_build_object('outcome',outcome_value,'reason',reason_value)) on conflict do nothing;
  insert into public.care_task_events(business_id,care_task_id,event_type,from_status,to_status,outcome,idempotency_key) values(target_business_id,t.id,'escalated',outcome_value,outcome_value,jsonb_build_object('severity',alert_severity),'escalated-'||event_id::text);
 end if;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,t.operational_visit_id,t.pet_visit_id,'care_task_outcome_recorded',initcap(t.task_type)||' outcome recorded.',jsonb_build_object('task_id',t.id,'outcome',outcome_value),auth.uid());
 return event_id;
end;$$;

do $$declare n text;begin foreach n in array array['care_tasks','care_task_events','operational_alerts'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);end loop;end$$;
create policy care_tasks_view on public.care_tasks for select to authenticated using((app.member_has_permission(business_id,'operations.record_feeding') or app.member_has_permission(business_id,'operations.record_medication')) and app.member_can_access_location(business_id,location_id));
create policy care_task_events_view on public.care_task_events for select to authenticated using(exists(select 1 from public.care_tasks t where t.business_id=care_task_events.business_id and t.id=care_task_events.care_task_id and (app.member_has_permission(t.business_id,'operations.record_feeding') or app.member_has_permission(t.business_id,'operations.record_medication')) and app.member_can_access_location(t.business_id,t.location_id)));
create policy operational_alerts_view on public.operational_alerts for select to authenticated using((app.member_has_permission(business_id,'operations.record_feeding') or app.member_has_permission(business_id,'operations.record_medication')) and app.member_can_access_location(business_id,location_id));
revoke all on function app.schedule_snapshot_care_task(uuid,uuid,text,text,jsonb,timestamptz,timestamptz,text,uuid,text),app.start_care_task(uuid,uuid,text),app.record_care_task_outcome(uuid,uuid,text,jsonb,boolean,text,text) from public;
grant execute on function app.schedule_snapshot_care_task(uuid,uuid,text,text,jsonb,timestamptz,timestamptz,text,uuid,text),app.start_care_task(uuid,uuid,text),app.record_care_task_outcome(uuid,uuid,text,jsonb,boolean,text,text) to authenticated;
