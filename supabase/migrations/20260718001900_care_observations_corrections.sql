-- PetCare E10 observations, alert lifecycle, and append-only task corrections.
insert into public.permission_definitions(permission_key,description,risk_level) values('operations.record_observation','Record activity, elimination, rest, and wellness observations.','standard') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.record_observation'),('manager','operations.record_observation'),('care_staff','operations.record_observation'),('groomer','operations.record_observation') on conflict do nothing;

create table public.visit_observations(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,
 category text not null check(category in('activity','elimination','rest','wellness')),observation_type text not null check(char_length(trim(observation_type)) between 2 and 100),
 details jsonb not null check(jsonb_typeof(details)='object'),concern_level text not null default 'information' check(concern_level in('information','warning','urgent','critical')),
 customer_visible boolean not null default false,observed_at timestamptz not null,recorded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),recorded_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,check(observed_at<=recorded_at+interval '5 minutes')
);
create index visit_observations_timeline_idx on public.visit_observations(business_id,pet_visit_id,observed_at desc);
create trigger visit_observations_immutable before update or delete on public.visit_observations for each row execute function app.prevent_commercial_snapshot_change();

alter table public.operational_alerts add column observation_id uuid,add column resolved_by uuid references auth.users(id) on delete restrict,add column resolved_at timestamptz,add column resolution_notes text,
 add constraint operational_alert_observation_fk foreign key(business_id,observation_id) references public.visit_observations(business_id,id) on delete restrict,
 add constraint operational_alert_ack_check check((acknowledged_at is null)=(acknowledged_by is null)),
 add constraint operational_alert_resolution_check check((resolved_at is null)=(resolved_by is null));
drop index if exists public.operational_alert_open_task_idx;
create unique index operational_alert_open_task_idx on public.operational_alerts(business_id,care_task_id,alert_type) where status in('open','acknowledged') and care_task_id is not null;
create unique index operational_alert_open_observation_idx on public.operational_alerts(business_id,observation_id,alert_type) where status in('open','acknowledged') and observation_id is not null;
create trigger operational_alerts_audit after insert or update or delete on public.operational_alerts for each row execute function app.audit_configuration_change('operations.alert.changed','operational_alert');

create table public.care_task_corrections(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,care_task_id uuid not null,original_event_id uuid not null,
 corrected_status text not null check(corrected_status in('completed','partial','refused','held','missed','unable','adverse')),corrected_outcome jsonb not null check(jsonb_typeof(corrected_outcome)='object'),
 reason text not null check(char_length(trim(reason)) between 12 and 1000),corrected_by uuid not null references auth.users(id) on delete restrict default auth.uid(),corrected_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,care_task_id) references public.care_tasks(business_id,id) on delete restrict,
 foreign key(business_id,original_event_id) references public.care_task_events(business_id,id) on delete restrict
);
create trigger care_task_corrections_immutable before update or delete on public.care_task_corrections for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.record_visit_observation(
 target_business_id uuid,target_pet_visit_id uuid,category_value text,type_value text,details_value jsonb,concern_value text,customer_visible_value boolean,observed_value timestamptz,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;v public.operational_visits%rowtype;created_id uuid;severity_value text;
begin
 if not app.member_has_permission(target_business_id,'operations.record_observation') then raise exception 'observation unavailable' using errcode='42501';end if;
 select id into created_id from public.visit_observations where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select p.* into pv from public.pet_visits p join public.operational_visits ov on ov.business_id=p.business_id and ov.id=p.operational_visit_id where p.business_id=target_business_id and p.id=target_pet_visit_id and p.status='in_care' and p.handoff_status='accepted' and app.member_can_access_location(ov.business_id,ov.location_id);
 select * into v from public.operational_visits where business_id=target_business_id and id=pv.operational_visit_id;
 if pv.id is null then raise exception 'active pet visit unavailable' using errcode='P0002';end if;
 if category_value not in('activity','elimination','rest','wellness') or concern_value not in('information','warning','urgent','critical') or jsonb_typeof(coalesce(details_value,'{}'))<>'object' or details_value='{}' or char_length(trim(coalesce(type_value,'')))<2 or observed_value>now()+interval '5 minutes' or observed_value<coalesce(v.arrived_at,v.scheduled_start) then raise exception 'structured observation required' using errcode='22023';end if;
 insert into public.visit_observations(business_id,location_id,operational_visit_id,pet_visit_id,pet_id,category,observation_type,details,concern_level,customer_visible,observed_at,idempotency_key)
 values(target_business_id,v.location_id,v.id,pv.id,pv.pet_id,category_value,trim(type_value),details_value,concern_value,coalesce(customer_visible_value,false),observed_value,trim(request_key)) returning id into created_id;
 if concern_value in('urgent','critical') then severity_value:=concern_value;
  insert into public.operational_alerts(business_id,location_id,operational_visit_id,pet_visit_id,observation_id,severity,alert_type,summary,details)
  values(target_business_id,v.location_id,v.id,pv.id,created_id,severity_value,'observation_'||category_value,initcap(category_value)||' observation requires follow-up.',jsonb_build_object('observation_type',type_value,'observation_id',created_id));
 end if;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id)
 values(target_business_id,v.id,pv.id,'visit_observation_recorded',initcap(category_value)||' observation recorded.',jsonb_build_object('observation_id',created_id,'concern_level',concern_value),auth.uid());return created_id;
end;$$;

create or replace function app.transition_operational_alert(target_business_id uuid,target_alert_id uuid,new_status text,notes_value text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.operational_alerts%rowtype;has_manager_role boolean;
begin
 if not (app.member_has_permission(target_business_id,'operations.record_observation') or app.member_has_permission(target_business_id,'operations.record_feeding') or app.member_has_permission(target_business_id,'operations.record_medication')) then raise exception 'alert action unavailable' using errcode='42501';end if;
 select * into a from public.operational_alerts where business_id=target_business_id and id=target_alert_id and app.member_can_access_location(business_id,location_id) for update;
 if a.id is null or new_status not in('acknowledged','resolved') or a.status='resolved' then raise exception 'open alert unavailable' using errcode='P0002';end if;
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into has_manager_role;
 if new_status='resolved' and (char_length(trim(coalesce(notes_value,'')))<8 or (a.severity='critical' and not has_manager_role)) then raise exception 'manager resolution and notes required' using errcode='42501';end if;
 update public.operational_alerts set status=new_status,acknowledged_by=coalesce(acknowledged_by,auth.uid()),acknowledged_at=coalesce(acknowledged_at,now()),resolved_by=case when new_status='resolved' then auth.uid() else resolved_by end,resolved_at=case when new_status='resolved' then now() else resolved_at end,resolution_notes=case when new_status='resolved' then trim(notes_value) else resolution_notes end where id=a.id;
end;$$;

create or replace function app.correct_care_task_outcome(target_business_id uuid,target_task_id uuid,corrected_status_value text,corrected_details jsonb,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.care_tasks%rowtype;original_id uuid;created_id uuid;has_manager_role boolean;
begin
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into has_manager_role;
 if not has_manager_role then raise exception 'task correction unavailable' using errcode='42501';end if;
 select id into created_id from public.care_task_corrections where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into t from public.care_tasks where business_id=target_business_id and id=target_task_id and app.member_can_access_location(business_id,location_id) for update;
 select id into original_id from public.care_task_events where business_id=target_business_id and care_task_id=t.id and event_type in('outcome_recorded','corrected') order by occurred_at desc limit 1;
 if t.id is null or original_id is null or corrected_status_value not in('completed','partial','refused','held','missed','unable','adverse') or (t.task_type='feeding' and corrected_status_value not in('completed','partial','refused','unable')) or (t.task_type='medication' and corrected_status_value='completed' and coalesce((corrected_details->>'five_rights_confirmed')::boolean,false)=false) or jsonb_typeof(coalesce(corrected_details,'{}'))<>'object' or corrected_details='{}' or char_length(trim(coalesce(reason_value,'')))<12 then raise exception 'documented correction unavailable' using errcode='22023';end if;
 insert into public.care_task_corrections(business_id,care_task_id,original_event_id,corrected_status,corrected_outcome,reason,idempotency_key) values(target_business_id,t.id,original_id,corrected_status_value,corrected_details,trim(reason_value),trim(request_key)) returning id into created_id;
 update public.care_tasks set status=corrected_status_value where id=t.id;
 insert into public.care_task_events(business_id,care_task_id,event_type,from_status,to_status,outcome,reason,idempotency_key) values(target_business_id,t.id,'corrected',t.status,corrected_status_value,jsonb_build_object('correction_id',created_id,'corrected_outcome',corrected_details),trim(reason_value),'corrected-'||created_id::text);
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,t.operational_visit_id,t.pet_visit_id,'care_task_outcome_corrected',initcap(t.task_type)||' outcome corrected without erasing history.',jsonb_build_object('task_id',t.id,'correction_id',created_id),auth.uid());return created_id;
end;$$;

do $$declare n text;begin foreach n in array array['visit_observations','care_task_corrections'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);end loop;end$$;
create policy visit_observations_view on public.visit_observations for select to authenticated using(app.member_has_permission(business_id,'operations.record_observation') and app.member_can_access_location(business_id,location_id));
create policy care_task_corrections_view on public.care_task_corrections for select to authenticated using(exists(select 1 from public.care_tasks t where t.business_id=care_task_corrections.business_id and t.id=care_task_corrections.care_task_id and (app.member_has_permission(t.business_id,'operations.record_feeding') or app.member_has_permission(t.business_id,'operations.record_medication')) and app.member_can_access_location(t.business_id,t.location_id)));
revoke all on function app.record_visit_observation(uuid,uuid,text,text,jsonb,text,boolean,timestamptz,text),app.transition_operational_alert(uuid,uuid,text,text),app.correct_care_task_outcome(uuid,uuid,text,jsonb,text,text) from public;
grant execute on function app.record_visit_observation(uuid,uuid,text,text,jsonb,text,boolean,timestamptz,text),app.transition_operational_alert(uuid,uuid,text,text),app.correct_care_task_outcome(uuid,uuid,text,jsonb,text,text) to authenticated;
