-- PetCare E10 grooming intake, changed-scope authorization, and quality review.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.manage_grooming','Record grooming intake, authorization, and quality review.','sensitive') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.manage_grooming'),('manager','operations.manage_grooming'),('groomer','operations.manage_grooming') on conflict do nothing;

create table public.grooming_intake_assessments(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,service_execution_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,
 requested_style text not null check(char_length(trim(requested_style)) between 2 and 1000),coat_condition text not null check(char_length(trim(coat_condition)) between 2 and 1000),skin_condition text not null check(char_length(trim(skin_condition)) between 2 and 1000),
 matting_severity text not null check(matting_severity in('none','mild','moderate','severe')),sensitivities text,risks text,additional_work text,
 material_change_required boolean not null default false,price_change_required boolean not null default false,approval_status text not null check(approval_status in('not_required','pending','approved','declined')),
 assessed_by uuid not null references auth.users(id) on delete restrict default auth.uid(),assessed_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict,
 foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 check((material_change_required or price_change_required)=(approval_status<>'not_required'))
);
create index grooming_intake_latest_idx on public.grooming_intake_assessments(business_id,service_execution_id,assessed_at desc);
create trigger grooming_intake_immutable before update or delete on public.grooming_intake_assessments for each row execute function app.prevent_commercial_snapshot_change();

create table public.grooming_change_authorizations(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,grooming_intake_id uuid not null,decision text not null check(decision in('approved','declined')),
 authorized_by_name text not null check(char_length(trim(authorized_by_name)) between 2 and 160),authority_relationship text not null check(authority_relationship in('owner','household_member','authorized_agent')),
 method text not null check(method in('in_person','phone','portal')),summary text not null check(char_length(trim(summary)) between 8 and 2000),
 recorded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),recorded_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,grooming_intake_id) references public.grooming_intake_assessments(business_id,id) on delete restrict
);
create trigger grooming_authorizations_immutable before update or delete on public.grooming_change_authorizations for each row execute function app.prevent_commercial_snapshot_change();

create table public.grooming_quality_reviews(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,service_execution_id uuid not null,
 outcome text not null check(outcome in('passed','rework','hold')),checklist jsonb not null check(jsonb_typeof(checklist)='object' and checklist<>'{}'),notes text not null check(char_length(trim(notes)) between 5 and 2000),
 reviewed_by uuid not null references auth.users(id) on delete restrict default auth.uid(),reviewed_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict
);
create index grooming_quality_latest_idx on public.grooming_quality_reviews(business_id,service_execution_id,reviewed_at desc);
create trigger grooming_quality_immutable before update or delete on public.grooming_quality_reviews for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.record_grooming_intake(target_business_id uuid,target_execution_id uuid,requested_style_value text,coat_value text,skin_value text,matting_value text,sensitivities_value text,risks_value text,additional_work_value text,material_change_value boolean,price_change_value boolean,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.service_executions%rowtype;created_id uuid;approval_value text;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_grooming') then raise exception 'grooming intake unavailable' using errcode='42501';end if;
 select id into created_id from public.grooming_intake_assessments where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and service_category='grooming' and stage in('intake','hold') and app.member_can_access_location(business_id,location_id) for update;
 if e.id is null or matting_value not in('none','mild','moderate','severe') or least(char_length(trim(coalesce(requested_style_value,''))),char_length(trim(coalesce(coat_value,''))),char_length(trim(coalesce(skin_value,''))))<2 or ((coalesce(material_change_value,false) or coalesce(price_change_value,false)) and char_length(trim(coalesce(additional_work_value,'')))<5) then raise exception 'structured grooming intake required' using errcode='22023';end if;
 approval_value:=case when coalesce(material_change_value,false) or coalesce(price_change_value,false) then 'pending' else 'not_required' end;
 insert into public.grooming_intake_assessments(business_id,location_id,service_execution_id,pet_visit_id,pet_id,requested_style,coat_condition,skin_condition,matting_severity,sensitivities,risks,additional_work,material_change_required,price_change_required,approval_status,idempotency_key)
 values(target_business_id,e.location_id,e.id,e.pet_visit_id,e.pet_id,trim(requested_style_value),trim(coat_value),trim(skin_value),matting_value,nullif(trim(sensitivities_value),''),nullif(trim(risks_value),''),nullif(trim(additional_work_value),''),coalesce(material_change_value,false),coalesce(price_change_value,false),approval_value,trim(request_key)) returning id into created_id;
 if approval_value='pending' and e.stage='intake' then
  update public.service_executions set stage='hold' where id=e.id;
  insert into public.service_execution_events(business_id,service_execution_id,from_stage,to_stage,notes,idempotency_key) values(target_business_id,e.id,'intake','hold','Material grooming change requires customer authorization.','intake-hold-'||created_id::text);
 end if;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,e.operational_visit_id,e.pet_visit_id,'grooming_intake_recorded','Structured grooming intake recorded.',jsonb_build_object('grooming_intake_id',created_id,'approval_status',approval_value),auth.uid());return created_id;
end;$$;

create or replace function app.record_grooming_change_authorization(target_business_id uuid,target_intake_id uuid,decision_value text,name_value text,relationship_value text,method_value text,summary_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.grooming_intake_assessments%rowtype;e public.service_executions%rowtype;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_grooming') then raise exception 'grooming authorization unavailable' using errcode='42501';end if;
 select id into created_id from public.grooming_change_authorizations where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into i from public.grooming_intake_assessments where business_id=target_business_id and id=target_intake_id and approval_status='pending';select * into e from public.service_executions where business_id=target_business_id and id=i.service_execution_id and stage='hold' and app.member_can_access_location(business_id,location_id) for update;
 if i.id is null or e.id is null or decision_value not in('approved','declined') or relationship_value not in('owner','household_member','authorized_agent') or method_value not in('in_person','phone','portal') or char_length(trim(coalesce(name_value,'')))<2 or char_length(trim(coalesce(summary_value,'')))<8 then raise exception 'documented customer authority required' using errcode='22023';end if;
 insert into public.grooming_change_authorizations(business_id,grooming_intake_id,decision,authorized_by_name,authority_relationship,method,summary,idempotency_key) values(target_business_id,i.id,decision_value,trim(name_value),relationship_value,method_value,trim(summary_value),trim(request_key)) returning id into created_id;
 -- Intake is immutable; latest authorization is authoritative and preserves the original pending snapshot.
 if decision_value='declined' then insert into public.operational_alerts(business_id,location_id,operational_visit_id,pet_visit_id,severity,alert_type,summary,details) values(target_business_id,e.location_id,e.operational_visit_id,e.pet_visit_id,'warning','grooming_change_declined','Customer declined the proposed grooming change.',jsonb_build_object('authorization_id',created_id,'intake_id',i.id)) on conflict do nothing;end if;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,e.operational_visit_id,e.pet_visit_id,'grooming_change_authorized','Grooming change was '||decision_value||' by an authorized customer.',jsonb_build_object('authorization_id',created_id,'decision',decision_value),auth.uid());return created_id;
end;$$;

create or replace function app.record_grooming_quality_review(target_business_id uuid,target_execution_id uuid,outcome_value text,checklist_value jsonb,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.service_executions%rowtype;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_grooming') then raise exception 'grooming review unavailable' using errcode='42501';end if;
 select id into created_id from public.grooming_quality_reviews where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and service_category='grooming' and stage='quality_review' and app.member_can_access_location(business_id,location_id);
 if e.id is null or outcome_value not in('passed','rework','hold') or jsonb_typeof(coalesce(checklist_value,'{}'))<>'object' or checklist_value='{}' or char_length(trim(coalesce(notes_value,'')))<5 then raise exception 'structured grooming quality review required' using errcode='22023';end if;
 insert into public.grooming_quality_reviews(business_id,location_id,service_execution_id,outcome,checklist,notes,idempotency_key) values(target_business_id,e.location_id,e.id,outcome_value,checklist_value,trim(notes_value),trim(request_key)) returning id into created_id;
 insert into public.operational_timeline_events(business_id,operational_visit_id,pet_visit_id,event_type,summary,details,actor_id) values(target_business_id,e.operational_visit_id,e.pet_visit_id,'grooming_quality_reviewed','Grooming quality review recorded as '||outcome_value||'.',jsonb_build_object('quality_review_id',created_id,'outcome',outcome_value),auth.uid());return created_id;
end;$$;

create or replace function app.enforce_grooming_execution_gate() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.grooming_intake_assessments%rowtype;authorization_value text;quality_value text;
begin
 if old.service_category<>'grooming' or old.stage=new.stage then return new;end if;
 if old.stage in('intake','hold') and new.stage in('bathing','processing') then
  select * into i from public.grooming_intake_assessments where business_id=old.business_id and service_execution_id=old.id order by assessed_at desc limit 1;
  if i.id is null then raise exception 'grooming intake required' using errcode='P0001';end if;
  if i.approval_status='pending' then select decision into authorization_value from public.grooming_change_authorizations where business_id=old.business_id and grooming_intake_id=i.id order by recorded_at desc limit 1;if authorization_value<>'approved' or authorization_value is null then raise exception 'approved grooming change required' using errcode='P0001';end if;end if;
 end if;
 if old.stage='quality_review' and new.stage='ready' then select outcome into quality_value from public.grooming_quality_reviews where business_id=old.business_id and service_execution_id=old.id order by reviewed_at desc limit 1;if quality_value<>'passed' or quality_value is null then raise exception 'passed grooming quality review required' using errcode='P0001';end if;end if;
 return new;
end;$$;
create trigger service_executions_grooming_gate before update of stage on public.service_executions for each row execute function app.enforce_grooming_execution_gate();

do $$declare n text;begin foreach n in array array['grooming_intake_assessments','grooming_change_authorizations','grooming_quality_reviews'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);execute format('grant select on public.%I to authenticated',n);end loop;end$$;
create policy grooming_intake_view on public.grooming_intake_assessments for select to authenticated using(app.member_has_permission(business_id,'operations.manage_grooming') and app.member_can_access_location(business_id,location_id));
create policy grooming_authorizations_view on public.grooming_change_authorizations for select to authenticated using(exists(select 1 from public.grooming_intake_assessments i where i.business_id=grooming_change_authorizations.business_id and i.id=grooming_change_authorizations.grooming_intake_id and app.member_has_permission(i.business_id,'operations.manage_grooming') and app.member_can_access_location(i.business_id,i.location_id)));
create policy grooming_quality_view on public.grooming_quality_reviews for select to authenticated using(app.member_has_permission(business_id,'operations.manage_grooming') and app.member_can_access_location(business_id,location_id));
revoke all on function app.record_grooming_intake(uuid,uuid,text,text,text,text,text,text,text,boolean,boolean,text),app.record_grooming_change_authorization(uuid,uuid,text,text,text,text,text,text),app.record_grooming_quality_review(uuid,uuid,text,jsonb,text,text) from public;
grant execute on function app.record_grooming_intake(uuid,uuid,text,text,text,text,text,text,text,boolean,boolean,text),app.record_grooming_change_authorization(uuid,uuid,text,text,text,text,text,text),app.record_grooming_quality_review(uuid,uuid,text,jsonb,text,text) to authenticated;
