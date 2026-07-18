-- PetCare E10 versioned digital report cards from authorized operational facts.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('operations.manage_report_cards','Draft, review, approve, and publish pet report cards.','sensitive') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','operations.manage_report_cards'),('manager','operations.manage_report_cards'),('care_staff','operations.manage_report_cards'),('groomer','operations.manage_report_cards') on conflict do nothing;

create table public.report_cards(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,operational_visit_id uuid not null,pet_visit_id uuid not null,pet_id uuid not null,service_execution_id uuid not null,
 service_category text not null check(service_category in('boarding','daycare','grooming')),status text not null default 'draft' check(status in('draft','review','approved','published','correction_review','archived')),
 current_version_number integer not null default 1 check(current_version_number>0),created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),published_at timestamptz,
 unique(business_id,id),unique(business_id,service_execution_id),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,operational_visit_id) references public.operational_visits(business_id,id) on delete restrict,foreign key(business_id,pet_visit_id) references public.pet_visits(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,foreign key(business_id,service_execution_id) references public.service_executions(business_id,id) on delete restrict
);
create index report_cards_queue_idx on public.report_cards(business_id,location_id,status,updated_at);
create trigger report_cards_updated before update on public.report_cards for each row execute function app.set_updated_at();
create trigger report_cards_tenant before update on public.report_cards for each row execute function app.prevent_business_id_change();
create trigger report_cards_audit after insert or update or delete on public.report_cards for each row execute function app.audit_configuration_change('operations.report_card.changed','report_card');

create table public.report_card_versions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,report_card_id uuid not null,version_number integer not null check(version_number>0),
 status text not null default 'draft' check(status in('draft','review','approved','published','superseded','archived')),narrative text not null check(char_length(trim(narrative)) between 8 and 4000),highlights jsonb not null check(jsonb_typeof(highlights)='object'),source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),
 correction_reason text,created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),approved_by uuid references auth.users(id) on delete restrict,approved_at timestamptz,published_by uuid references auth.users(id) on delete restrict,published_at timestamptz,idempotency_key text not null,
 unique(business_id,id),unique(business_id,report_card_id,version_number),unique(business_id,idempotency_key),foreign key(business_id,report_card_id) references public.report_cards(business_id,id) on delete restrict,
 check((approved_at is null)=(approved_by is null)),check((published_at is null)=(published_by is null))
);
create index report_card_versions_history_idx on public.report_card_versions(business_id,report_card_id,version_number desc);
create or replace function app.prevent_report_card_version_rewrite() returns trigger language plpgsql set search_path='' as $$begin if old.status='published' and new.status='superseded' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new;end if;if old.status in('published','superseded','archived') then raise exception 'published report card versions are immutable' using errcode='P0001';end if;return new;end;$$;
create trigger report_card_versions_immutable before update or delete on public.report_card_versions for each row execute function app.prevent_report_card_version_rewrite();

create table public.report_card_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,report_card_id uuid not null,report_card_version_id uuid not null,event_type text not null check(event_type in('drafted','submitted','approved','published','correction_started')),
 from_status text,to_status text not null,notes text,actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,report_card_id) references public.report_cards(business_id,id) on delete restrict,foreign key(business_id,report_card_version_id) references public.report_card_versions(business_id,id) on delete restrict
);
create trigger report_card_events_immutable before update or delete on public.report_card_events for each row execute function app.prevent_commercial_snapshot_change();

alter table public.transactional_message_outbox drop constraint transactional_message_outbox_message_type_check;
alter table public.transactional_message_outbox add constraint transactional_message_outbox_message_type_check check(message_type in('invoice_issued','payment_receipt','payment_failed','refund_issued','booking_confirmed','pet_checked_in','report_card_published'));

create or replace function app.create_report_card_draft(target_business_id uuid,target_execution_id uuid,narrative_value text,highlights_value jsonb,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.service_executions%rowtype;card_id uuid;version_id uuid;snapshot_value jsonb;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_report_cards') then raise exception 'report card unavailable' using errcode='42501';end if;
 select report_card_id into card_id from public.report_card_versions where business_id=target_business_id and idempotency_key=trim(request_key);if card_id is not null then return card_id;end if;
 select * into e from public.service_executions where business_id=target_business_id and id=target_execution_id and stage in('departure_preparation','ready','completed') and app.member_can_access_location(business_id,location_id);
 if e.id is null or char_length(trim(coalesce(narrative_value,'')))<8 or jsonb_typeof(coalesce(highlights_value,'{}'))<>'object' then raise exception 'customer-safe report card draft required' using errcode='22023';end if;
 snapshot_value:=jsonb_build_object(
  'observations',coalesce((select jsonb_agg(jsonb_build_object('category',o.category,'type',o.observation_type,'details',o.details,'observed_at',o.observed_at) order by o.observed_at) from public.visit_observations o where o.business_id=target_business_id and o.pet_visit_id=e.pet_visit_id and o.customer_visible),'[]'::jsonb),
  'care_outcomes',coalesce((select jsonb_agg(jsonb_build_object('task_type',t.task_type,'title',t.title,'status',t.status,'completed_at',t.completed_at) order by t.due_starts_at) from public.care_tasks t where t.business_id=target_business_id and t.pet_visit_id=e.pet_visit_id and t.status in('completed','partial','refused','held','missed','unable','adverse')),'[]'::jsonb),
  'customer_incidents',coalesce((select jsonb_agg(jsonb_build_object('category',i.category,'summary',i.customer_summary,'occurred_at',i.occurred_at) order by i.occurred_at) from public.operational_incidents i where i.business_id=target_business_id and i.pet_visit_id=e.pet_visit_id and i.customer_notified and i.customer_summary is not null),'[]'::jsonb));
 insert into public.report_cards(business_id,location_id,operational_visit_id,pet_visit_id,pet_id,service_execution_id,service_category) values(target_business_id,e.location_id,e.operational_visit_id,e.pet_visit_id,e.pet_id,e.id,e.service_category) on conflict(business_id,service_execution_id) do update set updated_at=now() returning id into card_id;
 if exists(select 1 from public.report_card_versions where business_id=target_business_id and report_card_id=card_id) then raise exception 'use correction workflow for an existing report card' using errcode='P0001';end if;
 insert into public.report_card_versions(business_id,report_card_id,version_number,narrative,highlights,source_snapshot,idempotency_key) values(target_business_id,card_id,1,trim(narrative_value),highlights_value,snapshot_value,trim(request_key)) returning id into version_id;
 insert into public.report_card_events(business_id,report_card_id,report_card_version_id,event_type,to_status,notes,idempotency_key) values(target_business_id,card_id,version_id,'drafted','draft','Draft created from authorized operational facts.','drafted-'||version_id::text);return card_id;
end;$$;

create or replace function app.transition_report_card(target_business_id uuid,target_report_card_id uuid,next_status text,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.report_cards%rowtype;v public.report_card_versions%rowtype;created_id uuid;manager_role boolean;event_value text;customer_id_value uuid;pet_name_value text;
begin
 if not app.member_has_permission(target_business_id,'operations.manage_report_cards') then raise exception 'report card transition unavailable' using errcode='42501';end if;
 select id into created_id from public.report_card_events where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 select * into c from public.report_cards where business_id=target_business_id and id=target_report_card_id and app.member_can_access_location(business_id,location_id) for update;
 select * into v from public.report_card_versions where business_id=target_business_id and report_card_id=c.id and version_number=c.current_version_number for update;
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into manager_role;
 if c.id is null or (c.status='draft' and next_status<>'review') or (c.status in('review','correction_review') and next_status<>'approved') or (c.status='approved' and next_status<>'published') or (next_status in('approved','published') and not manager_role) then raise exception 'controlled report card transition required' using errcode='P0001';end if;
 event_value:=case next_status when 'review' then 'submitted' when 'approved' then 'approved' else 'published' end;
 if next_status='published' then update public.report_card_versions set status='superseded' where business_id=target_business_id and report_card_id=c.id and status='published' and id<>v.id;end if;
 update public.report_cards set status=next_status,published_at=case when next_status='published' then now() else published_at end where id=c.id;
 update public.report_card_versions set status=next_status,approved_by=case when next_status='approved' then auth.uid() else approved_by end,approved_at=case when next_status='approved' then now() else approved_at end,published_by=case when next_status='published' then auth.uid() else published_by end,published_at=case when next_status='published' then now() else published_at end where id=v.id;
 insert into public.report_card_events(business_id,report_card_id,report_card_version_id,event_type,from_status,to_status,notes,idempotency_key) values(target_business_id,c.id,v.id,event_value,c.status,next_status,nullif(trim(notes_value),''),trim(request_key)) returning id into created_id;
 if next_status='published' then
  select b.customer_id,p.name into customer_id_value,pet_name_value from public.operational_visits ov join public.bookings b on b.business_id=ov.business_id and b.id=ov.booking_id join public.pets p on p.business_id=c.business_id and p.id=c.pet_id where ov.business_id=c.business_id and ov.id=c.operational_visit_id;
  insert into public.transactional_message_outbox(business_id,customer_id,booking_id,message_type,channel,template_data,idempotency_key) select target_business_id,customer_id_value,ov.booking_id,'report_card_published','email',jsonb_build_object('pet_name',pet_name_value,'report_card_id',c.id,'version',v.version_number),'report-card-'||v.id::text from public.operational_visits ov where ov.business_id=c.business_id and ov.id=c.operational_visit_id on conflict(business_id,idempotency_key) do nothing;
 end if;return created_id;
end;$$;

create or replace function app.start_report_card_correction(target_business_id uuid,target_report_card_id uuid,narrative_value text,highlights_value jsonb,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.report_cards%rowtype;old_v public.report_card_versions%rowtype;new_id uuid;manager_role boolean;
begin
 select exists(select 1 from public.business_memberships m join public.membership_roles mr on mr.business_id=m.business_id and mr.membership_id=m.id where m.business_id=target_business_id and m.identity_id=auth.uid() and m.state='active' and mr.role_key in('owner','manager')) into manager_role;if not manager_role then raise exception 'manager correction required' using errcode='42501';end if;
 select report_card_version_id into new_id from public.report_card_events where business_id=target_business_id and idempotency_key=trim(request_key);if new_id is not null then return new_id;end if;
 select * into c from public.report_cards where business_id=target_business_id and id=target_report_card_id and status='published' and app.member_can_access_location(business_id,location_id) for update;select * into old_v from public.report_card_versions where business_id=target_business_id and report_card_id=c.id and version_number=c.current_version_number;
 if c.id is null or char_length(trim(coalesce(narrative_value,'')))<8 or jsonb_typeof(coalesce(highlights_value,'{}'))<>'object' or char_length(trim(coalesce(reason_value,'')))<8 then raise exception 'documented report card correction required' using errcode='22023';end if;
 insert into public.report_card_versions(business_id,report_card_id,version_number,narrative,highlights,source_snapshot,correction_reason,status,idempotency_key) values(target_business_id,c.id,c.current_version_number+1,trim(narrative_value),highlights_value,old_v.source_snapshot,trim(reason_value),'review',trim(request_key)) returning id into new_id;
 update public.report_cards set status='correction_review',current_version_number=current_version_number+1 where id=c.id;
 insert into public.report_card_events(business_id,report_card_id,report_card_version_id,event_type,from_status,to_status,notes,idempotency_key) values(target_business_id,c.id,new_id,'correction_started','published','correction_review',trim(reason_value),'correction-'||new_id::text);return new_id;
end;$$;

alter table public.report_cards enable row level security;alter table public.report_cards force row level security;alter table public.report_card_versions enable row level security;alter table public.report_card_versions force row level security;alter table public.report_card_events enable row level security;alter table public.report_card_events force row level security;
revoke all on public.report_cards,public.report_card_versions,public.report_card_events from anon,authenticated;grant select on public.report_cards,public.report_card_versions,public.report_card_events to authenticated;
create policy report_cards_view on public.report_cards for select to authenticated using(app.member_has_permission(business_id,'operations.manage_report_cards') and app.member_can_access_location(business_id,location_id));
create policy report_card_versions_view on public.report_card_versions for select to authenticated using(exists(select 1 from public.report_cards c where c.business_id=report_card_versions.business_id and c.id=report_card_versions.report_card_id and app.member_has_permission(c.business_id,'operations.manage_report_cards') and app.member_can_access_location(c.business_id,c.location_id)));
create policy report_card_events_view on public.report_card_events for select to authenticated using(exists(select 1 from public.report_cards c where c.business_id=report_card_events.business_id and c.id=report_card_events.report_card_id and app.member_has_permission(c.business_id,'operations.manage_report_cards') and app.member_can_access_location(c.business_id,c.location_id)));
revoke all on function app.create_report_card_draft(uuid,uuid,text,jsonb,text),app.transition_report_card(uuid,uuid,text,text,text),app.start_report_card_correction(uuid,uuid,text,jsonb,text,text) from public;
grant execute on function app.create_report_card_draft(uuid,uuid,text,jsonb,text),app.transition_report_card(uuid,uuid,text,text,text),app.start_report_card_correction(uuid,uuid,text,jsonb,text,text) to authenticated;
