-- PetCare E14 purpose-bound, expiring, and download-audited platform audit exports.
alter table public.platform_permission_definitions drop constraint platform_permission_definitions_permission_key_check;
alter table public.platform_permission_definitions add constraint platform_permission_definitions_permission_key_check check(permission_key in(
 'platform.businesses.read','platform.businesses.manage','platform.audit.read','platform.audit.export','platform.subscriptions.read','platform.subscriptions.manage',
 'platform.features.read','platform.features.manage','platform.support.read','platform.support.manage','platform.support.write','platform.jobs.read','platform.jobs.manage',
 'platform.privacy.read','platform.privacy.manage','platform.health.read','platform.health.manage','platform.provisioning.read','platform.provisioning.manage',
 'platform.communications.read','platform.communications.manage','platform.notes.read','platform.notes.manage','platform.closure.read','platform.closure.manage'
));
insert into public.platform_permission_definitions(permission_key,description) values('platform.audit.export','Request, authorize, and download bounded platform audit exports.');
insert into public.platform_role_permissions(role_key,permission_key) values('platform_admin','platform.audit.export'),('platform_auditor','platform.audit.export');

create table public.platform_audit_export_requests(
 id uuid primary key default gen_random_uuid(),business_id uuid references public.businesses(id) on delete restrict,actor_filter uuid references public.identity_profiles(id) on delete restrict,
 event_query text,case_key_query text,occurred_from timestamptz not null,occurred_to timestamptz not null,result_limit integer not null check(result_limit between 1 and 250),
 purpose text not null check(char_length(trim(purpose)) between 12 and 500),status text not null default 'requested' check(status in('requested','approved','revoked','expired')),
 requested_by uuid not null references public.identity_profiles(id) on delete restrict,requested_at timestamptz not null default now(),approved_by uuid references public.identity_profiles(id) on delete restrict,
 approved_at timestamptz,expires_at timestamptz not null,download_count integer not null default 0 check(download_count>=0),last_downloaded_at timestamptz,
 check(occurred_to>occurred_from),check(occurred_to-occurred_from<=interval '366 days'),check(expires_at>requested_at),check(expires_at<=requested_at+interval '24 hours'),
 check((status='approved' and approved_at is not null and approved_by is not null)
   or (status='requested' and approved_at is null and approved_by is null)
   or status in('revoked','expired'))
);
create table public.platform_audit_export_events(
 id uuid primary key default gen_random_uuid(),platform_audit_export_request_id uuid not null references public.platform_audit_export_requests(id) on delete restrict,
 event_type text not null check(event_type in('requested','approved','downloaded','revoked','expired')),reason text not null check(char_length(trim(reason)) between 8 and 500),
 actor_id uuid not null references public.identity_profiles(id) on delete restrict,occurred_at timestamptz not null default now(),idempotency_key text not null unique
);
create trigger platform_audit_export_events_immutable before update or delete on public.platform_audit_export_events for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.request_platform_audit_export(target_business_id uuid,target_actor_id uuid,event_query_value text,case_key_query_value text,occurred_from_value timestamptz,occurred_to_value timestamptz,result_limit_value integer,purpose_value text,expires_at_value timestamptz,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 if not app.platform_has_permission('platform.audit.export') then raise exception 'platform audit export unavailable' using errcode='42501';end if;
 select platform_audit_export_request_id into request_id from public.platform_audit_export_events where idempotency_key=trim(request_key);if request_id is not null then return request_id;end if;
 if (target_business_id is not null and not exists(select 1 from public.businesses where id=target_business_id)) or occurred_from_value is null or occurred_to_value is null or occurred_to_value<=occurred_from_value or occurred_to_value-occurred_from_value>interval '366 days' or result_limit_value not between 1 and 250 or char_length(trim(coalesce(purpose_value,'')))<12 or expires_at_value<now()+interval '15 minutes' or expires_at_value>now()+interval '24 hours' then raise exception 'bounded purpose-bound audit export required' using errcode='22023';end if;
 insert into public.platform_audit_export_requests(business_id,actor_filter,event_query,case_key_query,occurred_from,occurred_to,result_limit,purpose,requested_by,expires_at) values(target_business_id,target_actor_id,nullif(trim(event_query_value),''),nullif(trim(case_key_query_value),''),occurred_from_value,occurred_to_value,result_limit_value,trim(purpose_value),auth.uid(),expires_at_value) returning id into request_id;
 insert into public.platform_audit_export_events(platform_audit_export_request_id,event_type,reason,actor_id,idempotency_key) values(request_id,'requested',trim(purpose_value),auth.uid(),trim(request_key));return request_id;
end;$$;
create or replace function app.approve_platform_audit_export(export_request_id_value uuid,reason_value text,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare request public.platform_audit_export_requests%rowtype;event_id uuid;
begin
 if not app.platform_has_permission('platform.audit.export') then raise exception 'platform audit export unavailable' using errcode='42501';end if;
 select id into event_id from public.platform_audit_export_events where idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into request from public.platform_audit_export_requests where id=export_request_id_value for update;
 if request.id is null or request.status<>'requested' or request.expires_at<=now() or char_length(trim(coalesce(reason_value,'')))<12 then raise exception 'current audit export approval required' using errcode='P0001';end if;
 update public.platform_audit_export_requests set status='approved',approved_by=auth.uid(),approved_at=now() where id=request.id;
 insert into public.platform_audit_export_events(platform_audit_export_request_id,event_type,reason,actor_id,idempotency_key) values(request.id,'approved',trim(reason_value),auth.uid(),trim(request_key)) returning id into event_id;return event_id;
end;$$;
create or replace function app.consume_platform_audit_export(export_request_id_value uuid,download_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.platform_audit_export_requests%rowtype;rows jsonb;event_id uuid;
begin
 if not app.platform_has_permission('platform.audit.export') then raise exception 'platform audit export unavailable' using errcode='42501';end if;
 select * into request from public.platform_audit_export_requests where id=export_request_id_value for update;
 if request.id is null or request.status<>'approved' or request.expires_at<=now() or char_length(trim(coalesce(download_key,'')))<8 then raise exception 'approved unexpired audit export required' using errcode='P0001';end if;
 rows:=app.search_platform_audit_events(request.business_id,request.actor_filter,request.event_query,request.case_key_query,request.occurred_from,request.occurred_to,request.result_limit);
 insert into public.platform_audit_export_events(platform_audit_export_request_id,event_type,reason,actor_id,idempotency_key) values(request.id,'downloaded','Approved audit export downloaded.',auth.uid(),trim(download_key)) on conflict(idempotency_key) do nothing returning id into event_id;
 if event_id is not null then update public.platform_audit_export_requests set download_count=download_count+1,last_downloaded_at=now() where id=request.id;end if;
 return jsonb_build_object('request_id',request.id,'purpose',request.purpose,'expires_at',request.expires_at,'rows',rows);
end;$$;
create or replace function app.list_platform_audit_export_requests() returns jsonb language plpgsql security definer stable set search_path='' as $$begin if not app.platform_has_permission('platform.audit.export') then raise exception 'platform audit export unavailable' using errcode='42501';end if;return coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'business_id',r.business_id,'business_name',b.name,'event_query',r.event_query,'case_key_query',r.case_key_query,'occurred_from',r.occurred_from,'occurred_to',r.occurred_to,'result_limit',r.result_limit,'purpose',r.purpose,'status',case when r.status='approved' and r.expires_at<=now() then 'expired' else r.status end,'expires_at',r.expires_at,'download_count',r.download_count,'requested_at',r.requested_at) order by r.requested_at desc) from public.platform_audit_export_requests r left join public.businesses b on b.id=r.business_id),'[]'::jsonb);end;$$;

alter table public.platform_audit_export_requests enable row level security;alter table public.platform_audit_export_requests force row level security;alter table public.platform_audit_export_events enable row level security;alter table public.platform_audit_export_events force row level security;
revoke all on public.platform_audit_export_requests,public.platform_audit_export_events from anon,authenticated;grant select on public.platform_audit_export_requests,public.platform_audit_export_events to authenticated;
create policy audit_export_requests_operator on public.platform_audit_export_requests for select to authenticated using(app.platform_has_permission('platform.audit.export'));
create policy audit_export_events_operator on public.platform_audit_export_events for select to authenticated using(app.platform_has_permission('platform.audit.read'));
revoke all on function app.request_platform_audit_export(uuid,uuid,text,text,timestamptz,timestamptz,integer,text,timestamptz,text),app.approve_platform_audit_export(uuid,text,text),app.consume_platform_audit_export(uuid,text),app.list_platform_audit_export_requests() from public;
grant execute on function app.request_platform_audit_export(uuid,uuid,text,text,timestamptz,timestamptz,integer,text,timestamptz,text),app.approve_platform_audit_export(uuid,text,text),app.consume_platform_audit_export(uuid,text),app.list_platform_audit_export_requests() to authenticated;
