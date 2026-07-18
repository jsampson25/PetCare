-- PetCare E12 customer self-service requests and safe profile maintenance.
create table public.customer_service_requests(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,customer_id uuid not null,household_id uuid not null,booking_id uuid,
 request_type text not null check(request_type in('booking_change','booking_cancellation','profile_support','document_support')),
 status text not null default 'submitted' check(status in('submitted','in_review','approved','declined','completed','withdrawn')),
 subject text not null check(char_length(trim(subject)) between 3 and 160),details jsonb not null check(jsonb_typeof(details)='object'),
 submitted_by uuid not null references auth.users(id) on delete restrict default auth.uid(),submitted_at timestamptz not null default now(),updated_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,foreign key(business_id,household_id) references public.households(business_id,id) on delete restrict,foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict
);
create index customer_service_requests_queue_idx on public.customer_service_requests(business_id,status,submitted_at);
create table public.customer_service_request_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,customer_service_request_id uuid not null,event_type text not null check(event_type in('submitted','review_started','approved','declined','completed','withdrawn')),
 from_status text,to_status text not null,notes text,actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),occurred_at timestamptz not null default now(),idempotency_key text not null,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,customer_service_request_id) references public.customer_service_requests(business_id,id) on delete restrict
);
create trigger customer_service_requests_updated before update on public.customer_service_requests for each row execute function app.set_updated_at();
create trigger customer_service_requests_tenant before update on public.customer_service_requests for each row execute function app.prevent_business_id_change();
create trigger customer_service_requests_audit after insert or update or delete on public.customer_service_requests for each row execute function app.audit_configuration_change('customer.service_request.changed','customer_service_request');
create trigger customer_service_request_events_immutable before update or delete on public.customer_service_request_events for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.submit_customer_service_request(target_business_id uuid,request_type_value text,target_booking_id uuid,subject_value text,details_value jsonb,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$declare access_record public.customer_portal_access%rowtype;created_id uuid;begin
 select * into access_record from public.customer_portal_access where business_id=target_business_id and identity_id=auth.uid() and status='active';
 select id into created_id from public.customer_service_requests where business_id=target_business_id and idempotency_key=trim(request_key);if created_id is not null then return created_id;end if;
 if access_record.id is null or request_type_value not in('booking_change','booking_cancellation','profile_support','document_support') or char_length(trim(coalesce(subject_value,'')))<3 or jsonb_typeof(details_value)<>'object' or char_length(trim(coalesce(details_value->>'message','')))<8 then raise exception 'customer request is incomplete' using errcode='22023';end if;
 if request_type_value in('booking_change','booking_cancellation') and not exists(select 1 from public.bookings b where b.business_id=target_business_id and b.id=target_booking_id and b.customer_id=access_record.customer_id and b.status not in('cancelled','completed','expired','no_show')) then raise exception 'booking is not available for request' using errcode='42501';end if;
 insert into public.customer_service_requests(business_id,customer_id,household_id,booking_id,request_type,subject,details,idempotency_key) values(target_business_id,access_record.customer_id,access_record.household_id,target_booking_id,request_type_value,trim(subject_value),details_value,trim(request_key)) returning id into created_id;
 insert into public.customer_service_request_events(business_id,customer_service_request_id,event_type,to_status,idempotency_key) values(target_business_id,created_id,'submitted','submitted',trim(request_key)||'-event');return created_id;
end;$$;

create or replace function app.update_portal_customer_profile(target_business_id uuid,preferred_name_value text,phone_value text)
returns uuid language plpgsql security definer set search_path='' as $$declare access_record public.customer_portal_access%rowtype;begin
 select * into access_record from public.customer_portal_access where business_id=target_business_id and identity_id=auth.uid() and status='active';
 if access_record.id is null or char_length(trim(coalesce(phone_value,'')))<7 or (nullif(trim(preferred_name_value),'') is not null and char_length(trim(preferred_name_value))>100) then raise exception 'customer profile update unavailable' using errcode='22023';end if;
 update public.customers set preferred_name=nullif(trim(preferred_name_value),''),phone=trim(phone_value) where business_id=target_business_id and id=access_record.customer_id;return access_record.customer_id;
end;$$;

create or replace function app.transition_customer_service_request(target_business_id uuid,target_request_id uuid,new_status_value text,notes_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$declare request_record public.customer_service_requests%rowtype;event_id uuid;event_value text;begin
 if not app.member_has_permission(target_business_id,'customers.manage') then raise exception 'customer request review unavailable' using errcode='42501';end if;
 select id into event_id from public.customer_service_request_events where business_id=target_business_id and idempotency_key=trim(request_key);if event_id is not null then return event_id;end if;
 select * into request_record from public.customer_service_requests where business_id=target_business_id and id=target_request_id for update;
 if request_record.id is null or new_status_value not in('in_review','approved','declined','completed') or (request_record.status,new_status_value) not in(('submitted','in_review'),('submitted','declined'),('in_review','approved'),('in_review','declined'),('approved','completed')) or char_length(trim(coalesce(notes_value,'')))<5 then raise exception 'invalid customer request transition' using errcode='22023';end if;
 event_value:=case new_status_value when 'in_review' then 'review_started' else new_status_value end;update public.customer_service_requests set status=new_status_value where id=request_record.id;
 insert into public.customer_service_request_events(business_id,customer_service_request_id,event_type,from_status,to_status,notes,idempotency_key) values(target_business_id,request_record.id,event_value,request_record.status,new_status_value,trim(notes_value),trim(request_key)) returning id into event_id;return event_id;
end;$$;

alter table public.customer_service_requests enable row level security;alter table public.customer_service_requests force row level security;alter table public.customer_service_request_events enable row level security;alter table public.customer_service_request_events force row level security;
revoke all on public.customer_service_requests,public.customer_service_request_events from anon,authenticated;grant select on public.customer_service_requests,public.customer_service_request_events to authenticated;
create policy customer_service_requests_view on public.customer_service_requests for select to authenticated using((exists(select 1 from public.customer_portal_access a where a.business_id=customer_service_requests.business_id and a.customer_id=customer_service_requests.customer_id and a.identity_id=auth.uid() and a.status='active')) or app.member_has_permission(business_id,'customers.manage'));
create policy customer_service_request_events_view on public.customer_service_request_events for select to authenticated using(exists(select 1 from public.customer_service_requests r where r.business_id=customer_service_request_events.business_id and r.id=customer_service_request_events.customer_service_request_id and ((exists(select 1 from public.customer_portal_access a where a.business_id=r.business_id and a.customer_id=r.customer_id and a.identity_id=auth.uid() and a.status='active')) or app.member_has_permission(r.business_id,'customers.manage'))));
revoke all on function app.submit_customer_service_request(uuid,text,uuid,text,jsonb,text),app.update_portal_customer_profile(uuid,text,text),app.transition_customer_service_request(uuid,uuid,text,text,text) from public;
grant execute on function app.submit_customer_service_request(uuid,text,uuid,text,jsonb,text),app.update_portal_customer_profile(uuid,text,text),app.transition_customer_service_request(uuid,uuid,text,text,text) to authenticated;
