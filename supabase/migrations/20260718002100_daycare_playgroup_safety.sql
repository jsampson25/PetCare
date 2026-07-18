-- PetCare E10 daycare evaluation and staffed playgroup safety workflow.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.manage_playgroup','Evaluate daycare pets and manage staffed playgroups.','sensitive') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.manage_playgroup'),('manager','operations.manage_playgroup'),('care_staff','operations.manage_playgroup') on conflict do nothing;

create table public.daycare_evaluations(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,service_execution_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,
 outcome text not null check(outcome in('approved','restricted','not_approved')),restrictions jsonb not null default '{}' check(jsonb_typeof(restrictions)='object'),notes text not null check(char_length(trim(notes)) between 5 and 2000),
 evaluated_by uuid not null references auth.users(id) on delete restrict default auth.uid(),evaluated_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict
);
create index daycare_evaluations_latest_idx on public.daycare_evaluations(business_id,pet_id,evaluated_at desc);
create trigger daycare_evaluations_immutable before update or delete on public.daycare_evaluations for each row execute function app.prevent_commercial_snapshot_change();

create table public.playgroup_sessions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,label text not null check(char_length(trim(label)) between 2 and 120),
 size_band text not null check(size_band in('small','medium','large','mixed','special_needs')),max_pets integer not null check(max_pets between 1 and 100),pets_per_staff integer not null check(pets_per_staff between 1 and 25),staff_count integer not null check(staff_count between 1 and 25),
 status text not null default 'active' check(status in('planned','active','completed','cancelled')),started_at timestamptz,ended_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 check((status='active')=(started_at is not null and ended_at is null) or status in('planned','completed','cancelled')),check(ended_at is null or ended_at>=started_at)
);
create index playgroup_sessions_board_idx on public.playgroup_sessions(business_id,location_id,status,started_at);
create trigger playgroup_sessions_updated before update on public.playgroup_sessions for each row execute function app.set_updated_at();
create trigger playgroup_sessions_tenant before update on public.playgroup_sessions for each row execute function app.prevent_business_id_change();
create trigger playgroup_sessions_audit after insert or update or delete on public.playgroup_sessions for each row execute function app.audit_configuration_change('operations.playgroup_session.changed','playgroup_session');

create table public.playgroup_participants(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,playgroup_session_id uuid not null,service_execution_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,
 status text not null default 'active' check(status in('active','resting','removed','completed')),restriction_snapshot jsonb not null default '{}' check(jsonb_typeof(restriction_snapshot)='object'),
 removal_category text check(removal_category in('safety','behavior','wellness','other')),removal_reason text,removed_by uuid references auth.users(id) on delete restrict,removed_at timestamptz,
 cleared_by uuid references auth.users(id) on delete restrict,cleared_at timestamptz,clearance_notes text,joined_at timestamptz not null default now(),completed_at timestamptz,
 unique(business_id,id),unique(business_id,playgroup_session_id,service_execution_id),
 foreign key(business_id,playgroup_session_id) references public.playgroup_sessions(business_id,id) on delete restrict,
 foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 check((removed_at is null)=(removed_by is null)),check(status<>'removed' or removal_reason is not null),check((cleared_at is null)=(cleared_by is null))
);
create index playgroup_participants_active_idx on public.playgroup_participants(business_id,playgroup_session_id,status);
create trigger playgroup_participants_tenant before update on public.playgroup_participants for each row execute function app.prevent_business_id_change();
create trigger playgroup_participants_audit after insert or update or delete on public.playgroup_participants for each row execute function app.audit_configuration_change('operations.playgroup_participant.changed','playgroup_participant');

create table public.playgroup_participant_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,playgroup_participant_id uuid not null,event_type text not null check(event_type in('joined','resting','returned','removed','cleared','completed')),
 from_status text,to_status text not null,notes text,actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,playgroup_participant_id) references public.playgroup_participants(business_id,id) on delete restrict
);
create trigger playgroup_participant_events_immutable before update or delete on public.playgroup_participant_events for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.record_daycare_evaluation(target_business_id uuid,target_execution_id uuid,outcome_value text,restrictions_value jsonb,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.service_executions%rowtype;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_playgroup') then raise exception 'daycare evaluation unavailable' using errcode='42501';end if;
 select id into created_id from public.daycare_evaluations where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and service_category='daycare' and stage in('attendance','evaluation','playgroup','resting','one_on_one') and app.member_can_access_location(business_id,location_id);
 if e.id is null or outcome_value not in('approved','restricted','not_approved') or jsonb_typeof(coalesce(restrictions_value,'{}'))<>'object' or char_length(trim(coalesce(notes_value,'')))<5 or (outcome_value='restricted' and restrictions_value='{}') then raise exception 'structured daycare evaluation required' using errcode='22023';end if;
 insert into public.daycare_evaluations(business_id,location_id,service_execution_id,pet_visit_id,pet_id,outcome,restrictions,notes,idempotency_key)
 values(target_business_id,e.location_id,e.id,e.pet_visit_id,e.pet_id,outcome_value,coalesce(restrictions_value,'{}'),trim(notes_value),trim(request_key)) returning id into created_id;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,e.operational_visit_id,e.pet_visit_id,'daycare_evaluation_recorded','Daycare evaluation recorded as '||replace(outcome_value,'_',' ')||'.',jsonb_build_object('evaluation_id',created_id,'outcome',outcome_value),auth.uid());return created_id;
end;$$;

create or replace function app.create_playgroup_session(target_business_id uuid,target_location_id uuid,label_value text,size_band_value text,max_pets_value integer,pets_per_staff_value integer,staff_count_value integer,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_playgroup') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'playgroup unavailable' using errcode='42501';end if;
 select id into created_id from public.playgroup_sessions where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 if char_length(trim(coalesce(label_value,'')))<2 or size_band_value not in('small','medium','large','mixed','special_needs') or max_pets_value not between 1 and 100 or pets_per_staff_value not between 1 and 25 or staff_count_value not between 1 and 25 then raise exception 'valid staffed playgroup required' using errcode='22023';end if;
 insert into public.playgroup_sessions(business_id,location_id,label,size_band,max_pets,pets_per_staff,staff_count,status,started_at,idempotency_key) values(target_business_id,target_location_id,trim(label_value),size_band_value,max_pets_value,pets_per_staff_value,staff_count_value,'active',now(),trim(request_key)) returning id into created_id;return created_id;
end;$$;

create or replace function app.add_playgroup_participant(target_business_id uuid,target_session_id uuid,target_execution_id uuid,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.playgroup_sessions%rowtype;e public.service_executions%rowtype;ev public.daycare_evaluations%rowtype;created_id uuid;active_count integer;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_playgroup') then raise exception 'playgroup participant unavailable' using errcode='42501';end if;
 select id into created_id from public.playgroup_participant_events where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then select playgroup_participant_id into created_id from public.playgroup_participant_events where id=created_id;return created_id;end if;
 select * into s from public.playgroup_sessions where business_id=target_business_id and id=target_session_id and status='active' and app.member_can_access_location(business_id,location_id) for update;
 select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and location_id=s.location_id and service_category='daycare' and stage='playgroup';
 select * into ev from public.daycare_evaluations where business_id=target_business_id and service_execution_id=e.id order by evaluated_at desc limit 1;
 select count(*) into active_count from public.playgroup_participants where business_id=target_business_id and playgroup_session_id=s.id and status='active';
 if s.id is null or e.id is null or ev.id is null or ev.outcome not in('approved','restricted') or active_count>=least(s.max_pets,s.pets_per_staff*s.staff_count) then raise exception 'safe playgroup placement unavailable' using errcode='P0001';end if;
 insert into public.playgroup_participants(business_id,playgroup_session_id,service_execution_id,pet_visit_id,pet_id,restriction_snapshot) values(target_business_id,s.id,e.id,e.pet_visit_id,e.pet_id,ev.restrictions) returning id into created_id;
 insert into public.playgroup_participant_events(business_id,playgroup_participant_id,event_type,to_status,notes,idempotency_key) values(target_business_id,created_id,'joined','active','Evaluation and staffed capacity verified.',trim(request_key));
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,e.operational_visit_id,e.pet_visit_id,'playgroup_joined','Pet joined staffed playgroup.',jsonb_build_object('session_id',s.id,'participant_id',created_id),auth.uid());return created_id;
end;$$;

create or replace function app.transition_playgroup_participant(target_business_id uuid,target_participant_id uuid,next_status text,category_value text,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.playgroup_participants%rowtype;s public.playgroup_sessions%rowtype;created_id uuid;event_value text;allowed boolean;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_playgroup') then raise exception 'playgroup transition unavailable' using errcode='42501';end if;
 select id into created_id from public.playgroup_participant_events where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into p from public.playgroup_participants where business_id=target_business_id and id=target_participant_id for update;select * into s from public.playgroup_sessions where business_id=target_business_id and id=p.playgroup_session_id and app.member_can_access_location(business_id,location_id);
 allowed:=(p.status,next_status) in(('active','resting'),('active','removed'),('active','completed'),('resting','active'),('resting','removed'),('resting','completed'),('removed','active'));
 if p.id is null or s.id is null or not allowed or (next_status='removed' and (category_value not in('safety','behavior','wellness','other') or char_length(trim(coalesce(notes_value,'')))<5)) or (p.status='removed' and next_status='active' and p.cleared_at is null) then raise exception 'documented playgroup transition unavailable' using errcode='22023';end if;
 event_value:=case next_status when 'resting' then 'resting' when 'removed' then 'removed' when 'completed' then 'completed' when 'active' then 'returned' end;
 update public.playgroup_participants set status=next_status,removal_category=case when next_status='removed' then category_value else removal_category end,removal_reason=case when next_status='removed' then trim(notes_value) else removal_reason end,removed_by=case when next_status='removed' then auth.uid() else removed_by end,removed_at=case when next_status='removed' then now() else removed_at end,completed_at=case when next_status='completed' then now() else completed_at end where id=p.id;
 insert into public.playgroup_participant_events(business_id,playgroup_participant_id,event_type,from_status,to_status,notes,idempotency_key) values(target_business_id,p.id,event_value,p.status,next_status,nullif(trim(notes_value),''),trim(request_key)) returning id into created_id;return created_id;
end;$$;

create or replace function app.clear_playgroup_removal(target_business_id uuid,target_participant_id uuid,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.playgroup_participants%rowtype;created_id uuid;manager_role boolean;
begin
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into manager_role;
 if not manager_role then raise exception 'manager clearance required' using errcode='42501';end if;
 select id into created_id from public.playgroup_participant_events where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select pp.* into p from public.playgroup_participants pp join public.playgroup_sessions s on s.business_id=pp.business_id and s.id=pp.playgroup_session_id where pp.business_id=target_business_id and pp.id=target_participant_id and pp.status='removed' and pp.cleared_at is null and app.member_can_access_location(s.business_id,s.location_id) for update of pp;
 if p.id is null or char_length(trim(coalesce(notes_value,'')))<8 then raise exception 'documented manager clearance required' using errcode='22023';end if;
 update public.playgroup_participants set cleared_by=auth.uid(),cleared_at=now(),clearance_notes=trim(notes_value) where id=p.id;
 insert into public.playgroup_participant_events(business_id,playgroup_participant_id,event_type,from_status,to_status,notes,idempotency_key) values(target_business_id,p.id,'cleared','removed','removed',trim(notes_value),trim(request_key)) returning id into created_id;return created_id;
end;$$;

do $$declare n text;begin foreach n in array array['daycare_evaluations','playgroup_sessions','playgroup_participants','playgroup_participant_events'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);end loop;end$$;
create policy daycare_evaluations_view on public.daycare_evaluations for select to authenticated using(app.member_has_permission(business_id,'operations.manage_playgroup') and app.member_can_access_location(business_id,location_id));
create policy playgroup_sessions_view on public.playgroup_sessions for select to authenticated using(app.member_has_permission(business_id,'operations.manage_playgroup') and app.member_can_access_location(business_id,location_id));
create policy playgroup_participants_view on public.playgroup_participants for select to authenticated using(exists(select 1 from public.playgroup_sessions s where s.business_id=playgroup_participants.business_id and s.id=playgroup_participants.playgroup_session_id and app.member_has_permission(s.business_id,'operations.manage_playgroup') and app.member_can_access_location(s.business_id,s.location_id)));
create policy playgroup_participant_events_view on public.playgroup_participant_events for select to authenticated using(exists(select 1 from public.playgroup_participants p join public.playgroup_sessions s on s.business_id=p.business_id and s.id=p.playgroup_session_id where p.business_id=playgroup_participant_events.business_id and p.id=playgroup_participant_events.playgroup_participant_id and app.member_has_permission(p.business_id,'operations.manage_playgroup') and app.member_can_access_location(s.business_id,s.location_id)));
revoke all on function app.record_daycare_evaluation(uuid,uuid,text,jsonb,text,text),app.create_playgroup_session(uuid,uuid,text,text,integer,integer,integer,text),app.add_playgroup_participant(uuid,uuid,uuid,text),app.transition_playgroup_participant(uuid,uuid,text,text,text,text),app.clear_playgroup_removal(uuid,uuid,text,text) from public;
grant execute on function app.record_daycare_evaluation(uuid,uuid,text,jsonb,text,text),app.create_playgroup_session(uuid,uuid,text,text,integer,integer,integer,text),app.add_playgroup_participant(uuid,uuid,uuid,text),app.transition_playgroup_participant(uuid,uuid,text,text,text,text),app.clear_playgroup_removal(uuid,uuid,text,text) to authenticated;
