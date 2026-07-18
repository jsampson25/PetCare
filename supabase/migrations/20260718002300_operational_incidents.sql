-- PetCare E10 operational incident reporting and controlled resolution.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.record_incident','Create and progress operational incident records.','sensitive') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.record_incident'),('manager','operations.record_incident'),('front_desk','operations.record_incident'),('care_staff','operations.record_incident'),('groomer','operations.record_incident') on conflict do nothing;

create table public.operational_incidents(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid,pet_id uuid,service_execution_id uuid,
 category text not null check(category in('injury','illness','bite_fight','escape','medication','feeding','behavior','facility','customer','other')),
 severity text not null check(severity in('information','minor','serious','critical')),status text not null default 'open' check(status in('open','stabilizing','monitoring','escalated','under_review','action_required','resolved','closed')),
 occurred_at timestamptz not null,initial_facts text not null check(char_length(trim(initial_facts)) between 8 and 4000),immediate_actions text not null check(char_length(trim(immediate_actions)) between 3 and 4000),
 internal_notes text,customer_summary text,customer_notified boolean not null default false,customer_notified_at timestamptz,manager_review_required boolean not null,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),resolved_by uuid references auth.users(id) on delete restrict,resolved_at timestamptz,closed_at timestamptz,idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict,
 check(occurred_at<=created_at+interval '5 minutes'),check((customer_notified_at is not null)=customer_notified),check((resolved_at is null)=(resolved_by is null)),check(closed_at is null or resolved_at is not null)
);
create index operational_incidents_queue_idx on public.operational_incidents(business_id,location_id,status,severity,occurred_at desc);
create trigger operational_incidents_tenant before update on public.operational_incidents for each row execute function app.prevent_business_id_change();
create trigger operational_incidents_audit after insert or update or delete on public.operational_incidents for each row execute function app.audit_configuration_change('operations.incident.changed','operational_incident');

create table public.operational_incident_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,operational_incident_id uuid not null,event_type text not null check(event_type in('reported','status_changed','customer_notified','resolved','closed')),
 from_status text,to_status text not null,notes text not null check(char_length(trim(notes)) between 3 and 4000),customer_summary text,
 actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,operational_incident_id) references public.operational_incidents(business_id,id) on delete restrict
);
create index operational_incident_events_history_idx on public.operational_incident_events(business_id,operational_incident_id,occurred_at);
create trigger operational_incident_events_immutable before update or delete on public.operational_incident_events for each row execute function app.prevent_commercial_snapshot_change();

alter table public.operational_alerts add column incident_id uuid,add constraint operational_alert_incident_fk foreign key(business_id,incident_id) references public.operational_incidents(business_id,id) on delete restrict;
create unique index operational_alert_active_incident_idx on public.operational_alerts(business_id,incident_id,alert_type) where status in('open','acknowledged') and incident_id is not null;

create or replace function app.create_operational_incident(target_business_id uuid,target_pet_visit_id uuid,target_execution_id uuid,category_value text,severity_value text,occurred_value timestamptz,facts_value text,actions_value text,internal_value text,customer_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare pv public.pet_visits%rowtype;v public.operational_visits%rowtype;e public.service_executions%rowtype;created_id uuid;manager_value boolean;
begin
 if not app.member_has_permission(target_business_id,'operations.record_incident') then raise exception 'incident reporting unavailable' using errcode='42501';end if;
 select id into created_id from public.operational_incidents where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select p.* into pv from public.pet_visits p join public.operational_visits ov on ov.business_id=p.business_id and ov.id=p.operational_visit_id where p.business_id=target_business_id and p.id=target_pet_visit_id and p.status='in_care' and app.member_can_access_location(ov.business_id,ov.location_id);
 select * into v from public.operational_visits where business_id=target_business_id and id=pv.operational_visit_id;
 if target_execution_id is not null then select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and pet_visit_id=pv.id;end if;
 manager_value:=severity_value in('serious','critical');
 if pv.id is null or (target_execution_id is not null and e.id is null) or category_value not in('injury','illness','bite_fight','escape','medication','feeding','behavior','facility','customer','other') or severity_value not in('information','minor','serious','critical') or occurred_value>now()+interval '5 minutes' or occurred_value<coalesce(v.arrived_at,v.scheduled_start) or char_length(trim(coalesce(facts_value,'')))<8 or char_length(trim(coalesce(actions_value,'')))<3 then raise exception 'structured incident facts required' using errcode='22023';end if;
 insert into public.operational_incidents(business_id,location_id,operational_visit_id,pet_visit_id,pet_id,service_execution_id,category,severity,status,occurred_at,initial_facts,immediate_actions,internal_notes,customer_summary,manager_review_required,idempotency_key)
 values(target_business_id,v.location_id,v.id,pv.id,pv.pet_id,e.id,category_value,severity_value,case when manager_value then 'escalated' else 'open' end,occurred_value,trim(facts_value),trim(actions_value),nullif(trim(internal_value),''),nullif(trim(customer_value),''),manager_value,trim(request_key)) returning id into created_id;
 if severity_value in('serious','critical') then
  insert into public.operational_alerts(business_id,location_id,operational_visit_id,pet_visit_id,incident_id,severity,alert_type,summary,details) values(target_business_id,v.location_id,v.id,pv.id,created_id,case when severity_value='critical' then 'critical' else 'urgent' end,'incident_'||category_value,initcap(replace(category_value,'_',' '))||' incident requires manager response.',jsonb_build_object('incident_id',created_id,'severity',severity_value));
  if e.id is not null and e.stage not in('hold','ready','completed') then update public.service_executions set stage='hold' where id=e.id;insert into public.service_execution_events(business_id,service_execution_id,from_stage,to_stage,notes,idempotency_key) values(target_business_id,e.id,e.stage,'hold','Serious incident requires operational review.','incident-hold-'||created_id::text);end if;
 end if;
 insert into public.operational_incident_events(business_id,operational_incident_id,event_type,to_status,notes,customer_summary,idempotency_key) values(target_business_id,created_id,'reported',case when manager_value then 'escalated' else 'open' end,trim(actions_value),nullif(trim(customer_value),''),'incident-reported-'||created_id::text);
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,v.id,pv.id,'incident_reported',initcap(replace(category_value,'_',' '))||' incident reported.',jsonb_build_object('incident_id',created_id,'severity',severity_value),auth.uid());return created_id;
end;$$;

create or replace function app.transition_operational_incident(target_business_id uuid,target_incident_id uuid,next_status text,notes_value text,customer_notified_value boolean,customer_summary_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.operational_incidents%rowtype;created_id uuid;allowed boolean;manager_role boolean;event_value text;
begin
 if not app.member_has_permission(target_business_id,'operations.record_incident') then raise exception 'incident transition unavailable' using errcode='42501';end if;
 select id into created_id from public.operational_incident_events where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into i from public.operational_incidents where business_id=target_business_id and id=target_incident_id and app.member_can_access_location(business_id,location_id) for update;
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into manager_role;
 allowed:=case i.status when 'open' then next_status in('stabilizing','monitoring','escalated','under_review') when 'stabilizing' then next_status in('monitoring','escalated','under_review') when 'monitoring' then next_status in('escalated','under_review') when 'escalated' then next_status='under_review' when 'under_review' then next_status in('action_required','resolved') when 'action_required' then next_status in('under_review','resolved') when 'resolved' then next_status='closed' else false end;
 if i.id is null or not allowed or char_length(trim(coalesce(notes_value,'')))<3 or (next_status in('resolved','closed') and i.manager_review_required and not manager_role) or (coalesce(customer_notified_value,false) and char_length(trim(coalesce(customer_summary_value,'')))<8) then raise exception 'documented incident transition unavailable' using errcode='22023';end if;
 event_value:=case next_status when 'resolved' then 'resolved' when 'closed' then 'closed' else case when customer_notified_value then 'customer_notified' else 'status_changed' end end;
 update public.operational_incidents set status=next_status,customer_notified=customer_notified or coalesce(customer_notified_value,false),customer_notified_at=case when customer_notified_value then coalesce(customer_notified_at,now()) else customer_notified_at end,customer_summary=case when customer_notified_value then trim(customer_summary_value) else customer_summary end,resolved_by=case when next_status='resolved' then auth.uid() else resolved_by end,resolved_at=case when next_status='resolved' then now() else resolved_at end,closed_at=case when next_status='closed' then now() else closed_at end where id=i.id;
 insert into public.operational_incident_events(business_id,operational_incident_id,event_type,from_status,to_status,notes,customer_summary,idempotency_key) values(target_business_id,i.id,event_value,i.status,next_status,trim(notes_value),case when customer_notified_value then trim(customer_summary_value) end,trim(request_key)) returning id into created_id;
 if next_status in('resolved','closed') then update public.operational_alerts set status='resolved',acknowledged_by=coalesce(acknowledged_by,auth.uid()),acknowledged_at=coalesce(acknowledged_at,now()),resolved_by=auth.uid(),resolved_at=now(),resolution_notes=trim(notes_value) where business_id=target_business_id and incident_id=i.id and status in('open','acknowledged');end if;
 return created_id;
end;$$;

alter table public.operational_incidents enable row level security;alter table public.operational_incidents force row level security;
alter table public.operational_incident_events enable row level security;alter table public.operational_incident_events force row level security;
revoke all on public.operational_incidents,public.operational_incident_events from anon,authenticated;grant select on public.operational_incidents,public.operational_incident_events to authenticated;
create policy operational_incidents_view on public.operational_incidents for select to authenticated using(app.member_has_permission(business_id,'operations.record_incident') and app.member_can_access_location(business_id,location_id));
create policy operational_incident_events_view on public.operational_incident_events for select to authenticated using(exists(select 1 from public.operational_incidents i where i.business_id=operational_incident_events.business_id and i.id=operational_incident_events.operational_incident_id and app.member_has_permission(i.business_id,'operations.record_incident') and app.member_can_access_location(i.business_id,i.location_id)));
revoke all on function app.create_operational_incident(uuid,uuid,uuid,text,text,timestamptz,text,text,text,text,text),app.transition_operational_incident(uuid,uuid,text,text,boolean,text,text) from public;
grant execute on function app.create_operational_incident(uuid,uuid,uuid,text,text,timestamptz,text,text,text,text,text),app.transition_operational_incident(uuid,uuid,text,text,boolean,text,text) to authenticated;
