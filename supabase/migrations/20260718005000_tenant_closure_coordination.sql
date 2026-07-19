-- PetCare E14 tenant closure readiness, retention holds, and purge eligibility coordination.
alter table public.platform_permission_definitions drop constraint platform_permission_definitions_permission_key_check;
alter table public.platform_permission_definitions add constraint platform_permission_definitions_permission_key_check check (permission_key in (
  'platform.businesses.read','platform.businesses.manage','platform.audit.read','platform.subscriptions.read','platform.subscriptions.manage',
  'platform.features.read','platform.features.manage','platform.support.read','platform.support.manage','platform.support.write',
  'platform.jobs.read','platform.jobs.manage','platform.privacy.read','platform.privacy.manage','platform.health.read','platform.health.manage',
  'platform.provisioning.read','platform.provisioning.manage','platform.communications.read','platform.communications.manage',
  'platform.notes.read','platform.notes.manage','platform.closure.read','platform.closure.manage'
));
insert into public.platform_permission_definitions(permission_key,description) values
('platform.closure.read','View tenant closure readiness and minimized retention obligations.'),
('platform.closure.manage','Coordinate closure, retention holds, and purge eligibility.');
insert into public.platform_role_permissions(role_key,permission_key) values
('platform_admin','platform.closure.read'),('platform_admin','platform.closure.manage'),
('platform_support','platform.closure.read'),('platform_auditor','platform.closure.read');

create table public.tenant_closure_cases(
 id uuid primary key default gen_random_uuid(),business_id uuid not null unique references public.businesses(id) on delete restrict,
 status text not null default 'review' check(status in('review','closing','closed','purge_eligible')),
 requested_reason text not null check(char_length(trim(requested_reason)) between 12 and 500),requested_by uuid not null references public.identity_profiles(id) on delete restrict,
 requested_at timestamptz not null default now(),target_close_at timestamptz not null,export_ready boolean not null default false,
 export_reference text,retention_until date not null,closed_at timestamptz,purge_eligible_at timestamptz,
 check(target_close_at>requested_at),check((export_ready=false and export_reference is null) or (export_ready and char_length(trim(export_reference))>=8))
);
create table public.tenant_retention_holds(
 id uuid primary key default gen_random_uuid(),tenant_closure_case_id uuid not null references public.tenant_closure_cases(id) on delete restrict,
 business_id uuid not null references public.businesses(id) on delete restrict,hold_type text not null check(hold_type in('legal','financial','security','privacy','contract')),
 basis text not null check(char_length(trim(basis)) between 12 and 500),status text not null default 'active' check(status in('active','released')),
 expires_at timestamptz,created_by uuid not null references public.identity_profiles(id) on delete restrict,created_at timestamptz not null default now(),released_at timestamptz
);
create table public.tenant_closure_events(
 id uuid primary key default gen_random_uuid(),tenant_closure_case_id uuid not null references public.tenant_closure_cases(id) on delete restrict,
 business_id uuid not null references public.businesses(id) on delete restrict,event_type text not null check(event_type in('created','export_ready','hold_added','hold_released','closing','closed','purge_eligible')),
 from_status text,to_status text,reason text not null check(char_length(trim(reason)) between 8 and 2000),actor_id uuid not null references public.identity_profiles(id) on delete restrict,
 occurred_at timestamptz not null default now(),idempotency_key text not null unique
);
create trigger tenant_closure_events_immutable before update or delete on public.tenant_closure_events for each row execute function app.prevent_commercial_snapshot_change();
create trigger tenant_retention_holds_immutable before delete on public.tenant_retention_holds for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.tenant_closure_readiness(target_business_id uuid) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare case_record public.tenant_closure_cases%rowtype;active_care bigint;future_bookings bigint;outstanding bigint;active_holds bigint;ready boolean;fingerprint text;
begin
 if not app.platform_has_permission('platform.closure.read') then raise exception 'tenant closure readiness unavailable' using errcode='42501';end if;
 select * into case_record from public.tenant_closure_cases where business_id=target_business_id;
 select count(*) into active_care from public.pet_visits where business_id=target_business_id and status in('arrived','in_care');
 select count(*) into future_bookings from public.bookings b where b.business_id=target_business_id and b.status not in('cancelled','completed','expired','no_show') and exists(select 1 from public.booking_items i where i.business_id=b.business_id and i.booking_id=b.id and i.ends_at>now());
 select coalesce(sum(greatest(balance_due_minor,0)),0) into outstanding from public.invoice_balances where business_id=target_business_id;
 select count(*) into active_holds from public.tenant_retention_holds where business_id=target_business_id and status='active' and (expires_at is null or expires_at>now());
 ready:=case_record.id is not null and case_record.export_ready and active_care=0 and future_bookings=0 and outstanding=0;
 fingerprint:=md5(concat_ws(':',target_business_id,active_care,future_bookings,outstanding,active_holds,coalesce(case_record.export_ready,false),coalesce(case_record.retention_until::text,'')));
 return jsonb_build_object('business_id',target_business_id,'case_id',case_record.id,'status',case_record.status,'active_pets_in_care',active_care,'future_bookings',future_bookings,'outstanding_balance_minor',outstanding,'active_holds',active_holds,'export_ready',coalesce(case_record.export_ready,false),'retention_until',case_record.retention_until,'ready_to_close',ready,'purge_permitted',ready and case_record.status='closed' and active_holds=0 and case_record.retention_until<=current_date,'fingerprint',fingerprint);
end;$$;

create or replace function app.create_tenant_closure_case(target_business_id uuid,target_close_at_value timestamptz,retention_until_value date,reason_value text,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare case_id uuid;
begin
 if not app.platform_has_permission('platform.closure.manage') then raise exception 'tenant closure management unavailable' using errcode='42501';end if;
 select tenant_closure_case_id into case_id from public.tenant_closure_events where idempotency_key=trim(request_key);if case_id is not null then return case_id;end if;
 if not exists(select 1 from public.businesses where id=target_business_id) or exists(select 1 from public.tenant_closure_cases where business_id=target_business_id) or target_close_at_value<=now() or retention_until_value<target_close_at_value::date or char_length(trim(coalesce(reason_value,'')))<12 then raise exception 'valid documented tenant closure case required' using errcode='22023';end if;
 insert into public.tenant_closure_cases(business_id,requested_reason,requested_by,target_close_at,retention_until) values(target_business_id,trim(reason_value),auth.uid(),target_close_at_value,retention_until_value) returning id into case_id;
 insert into public.tenant_closure_events(tenant_closure_case_id,business_id,event_type,to_status,reason,actor_id,idempotency_key) values(case_id,target_business_id,'created','review',trim(reason_value),auth.uid(),trim(request_key));return case_id;
end;$$;

create or replace function app.mark_tenant_closure_export_ready(closure_case_id_value uuid,export_reference_value text,reason_value text,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare case_record public.tenant_closure_cases%rowtype;event_id uuid;
begin
 if not app.platform_has_permission('platform.closure.manage') then raise exception 'tenant closure management unavailable' using errcode='42501';end if;
 select id into event_id from public.tenant_closure_events where idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into case_record from public.tenant_closure_cases where id=closure_case_id_value for update;
 if case_record.id is null or case_record.status<>'review' or char_length(trim(coalesce(export_reference_value,'')))<8 or char_length(trim(coalesce(reason_value,'')))<12 then raise exception 'verified closure export required' using errcode='P0001';end if;
 update public.tenant_closure_cases set export_ready=true,export_reference=trim(export_reference_value) where id=case_record.id;
 insert into public.tenant_closure_events(tenant_closure_case_id,business_id,event_type,from_status,to_status,reason,actor_id,idempotency_key) values(case_record.id,case_record.business_id,'export_ready','review','review',trim(reason_value),auth.uid(),trim(request_key)) returning id into event_id;return event_id;
end;$$;

create or replace function app.add_tenant_retention_hold(closure_case_id_value uuid,hold_type_value text,basis_value text,expires_at_value timestamptz,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare case_record public.tenant_closure_cases%rowtype;hold_id uuid;
begin
 if not app.platform_has_permission('platform.closure.manage') then raise exception 'tenant closure management unavailable' using errcode='42501';end if;
 select * into case_record from public.tenant_closure_cases where id=closure_case_id_value;
 if case_record.id is null or hold_type_value not in('legal','financial','security','privacy','contract') or char_length(trim(coalesce(basis_value,'')))<12 or (expires_at_value is not null and expires_at_value<=now()) then raise exception 'valid retention hold required' using errcode='22023';end if;
 insert into public.tenant_retention_holds(tenant_closure_case_id,business_id,hold_type,basis,expires_at,created_by) values(case_record.id,case_record.business_id,hold_type_value,trim(basis_value),expires_at_value,auth.uid()) returning id into hold_id;
 insert into public.tenant_closure_events(tenant_closure_case_id,business_id,event_type,from_status,to_status,reason,actor_id,idempotency_key) values(case_record.id,case_record.business_id,'hold_added',case_record.status,case_record.status,trim(basis_value),auth.uid(),trim(request_key));return hold_id;
end;$$;

create or replace function app.transition_tenant_closure(closure_case_id_value uuid,next_status_value text,readiness_fingerprint_value text,reason_value text,confirmation_value text,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare case_record public.tenant_closure_cases%rowtype;business public.businesses%rowtype;readiness jsonb;event_id uuid;
begin
 if not app.platform_has_permission('platform.closure.manage') then raise exception 'tenant closure management unavailable' using errcode='42501';end if;
 select id into event_id from public.tenant_closure_events where idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into case_record from public.tenant_closure_cases where id=closure_case_id_value for update;select * into business from public.businesses where id=case_record.business_id;readiness:=app.tenant_closure_readiness(case_record.business_id);
 if case_record.id is null or char_length(trim(coalesce(reason_value,'')))<12 or readiness->>'fingerprint'<>trim(coalesce(readiness_fingerprint_value,'')) or lower(trim(coalesce(confirmation_value,'')))<>business.public_slug or (case_record.status,next_status_value) not in(('review','closing'),('closing','closed'),('closed','purge_eligible')) or (next_status_value in('closing','closed') and not (readiness->>'ready_to_close')::boolean) or (next_status_value='purge_eligible' and not (readiness->>'purge_permitted')::boolean) then raise exception 'current closure readiness and explicit confirmation required' using errcode='P0001';end if;
 update public.tenant_closure_cases set status=next_status_value,closed_at=case when next_status_value='closed' then now() else closed_at end,purge_eligible_at=case when next_status_value='purge_eligible' then now() else purge_eligible_at end where id=case_record.id;
 if next_status_value='closing' then update public.platform_tenant_controls set lifecycle_status='closing',block_new_bookings=true,block_marketing=true,tenant_read_only=true,preserve_care_access=true,restriction_code='tenant_closure',restriction_reason=trim(reason_value),changed_by=auth.uid(),changed_at=now() where business_id=case_record.business_id;end if;
 if next_status_value='closed' then update public.platform_tenant_controls set lifecycle_status='closed',block_new_bookings=true,block_marketing=true,tenant_read_only=true,restriction_code=null,restriction_reason=null,changed_by=auth.uid(),changed_at=now() where business_id=case_record.business_id;update public.businesses set status='archived' where id=case_record.business_id;end if;
 insert into public.tenant_closure_events(tenant_closure_case_id,business_id,event_type,from_status,to_status,reason,actor_id,idempotency_key) values(case_record.id,case_record.business_id,next_status_value,case_record.status,next_status_value,trim(reason_value),auth.uid(),trim(request_key)) returning id into event_id;return event_id;
end;$$;

create or replace function app.list_tenant_closure_cases() returns jsonb language plpgsql security definer stable set search_path='' as $$begin if not app.platform_has_permission('platform.closure.read') then raise exception 'tenant closure directory unavailable' using errcode='42501';end if;return coalesce((select jsonb_agg(jsonb_build_object('case_id',c.id,'business_id',c.business_id,'business_name',b.name,'public_slug',b.public_slug,'status',c.status,'target_close_at',c.target_close_at,'retention_until',c.retention_until,'export_ready',c.export_ready,'readiness',app.tenant_closure_readiness(c.business_id),'holds',coalesce((select jsonb_agg(jsonb_build_object('hold_id',h.id,'hold_type',h.hold_type,'basis',h.basis,'status',h.status,'expires_at',h.expires_at)) from public.tenant_retention_holds h where h.tenant_closure_case_id=c.id),'[]'::jsonb)) order by c.requested_at desc) from public.tenant_closure_cases c join public.businesses b on b.id=c.business_id),'[]'::jsonb);end;$$;

do $$declare n text;begin foreach n in array array['tenant_closure_cases','tenant_retention_holds','tenant_closure_events'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);execute format('revoke all on public.%I from anon,authenticated',n);end loop;end$$;
grant select on public.tenant_closure_cases,public.tenant_retention_holds,public.tenant_closure_events to authenticated;
create policy closure_cases_operator on public.tenant_closure_cases for select to authenticated using(app.platform_has_permission('platform.closure.read'));
create policy closure_holds_operator on public.tenant_retention_holds for select to authenticated using(app.platform_has_permission('platform.closure.read'));
create policy closure_events_operator on public.tenant_closure_events for select to authenticated using(app.platform_has_permission('platform.audit.read'));
revoke all on function app.tenant_closure_readiness(uuid),app.create_tenant_closure_case(uuid,timestamptz,date,text,text),app.mark_tenant_closure_export_ready(uuid,text,text,text),app.add_tenant_retention_hold(uuid,text,text,timestamptz,text),app.transition_tenant_closure(uuid,text,text,text,text,text),app.list_tenant_closure_cases() from public;
grant execute on function app.tenant_closure_readiness(uuid),app.create_tenant_closure_case(uuid,timestamptz,date,text,text),app.mark_tenant_closure_export_ready(uuid,text,text,text),app.add_tenant_retention_hold(uuid,text,text,timestamptz,text),app.transition_tenant_closure(uuid,text,text,text,text,text),app.list_tenant_closure_cases() to authenticated;
