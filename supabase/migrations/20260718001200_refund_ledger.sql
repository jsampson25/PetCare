-- PetCare E08 refund requests, credits, receipts, and Stripe reconciliation.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('payments.refund','Issue full or partial customer refunds.','high') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','payments.refund'),('manager','payments.refund'),('accountant','payments.refund') on conflict do nothing;

create table public.refund_requests(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,payment_id uuid not null,invoice_id uuid not null,
 amount_minor bigint not null check(amount_minor>0),currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),reason text not null check(char_length(trim(reason)) between 5 and 500),
 provider text not null check(provider in('manual','stripe')),status text not null check(status in('created','processing','succeeded','failed')),
 provider_reference text,idempotency_key text not null,failure_category text,requested_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(business_id,id),unique(business_id,idempotency_key),
 foreign key(business_id,payment_id) references public.payments(business_id,id) on delete restrict,
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict
);
create table public.refunds(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,refund_request_id uuid not null,payment_id uuid not null,invoice_id uuid not null,
 amount_minor bigint not null check(amount_minor>0),currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),provider text not null,provider_reference text,
 reason text not null,refunded_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(business_id,id),unique(business_id,refund_request_id),
 foreign key(business_id,refund_request_id) references public.refund_requests(business_id,id) on delete restrict,
 foreign key(business_id,payment_id) references public.payments(business_id,id) on delete restrict,
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict
);
create unique index refunds_provider_reference_idx on public.refunds(provider,provider_reference) where provider_reference is not null;
create table public.invoice_credits(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,invoice_id uuid not null,refund_id uuid not null,amount_minor bigint not null check(amount_minor>0),
 reason text not null,created_at timestamptz not null default now(),unique(business_id,id),unique(business_id,refund_id),
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,
 foreign key(business_id,refund_id) references public.refunds(business_id,id) on delete restrict
);
create table public.refund_receipts(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,invoice_id uuid not null,refund_id uuid not null,receipt_number text not null,
 amount_minor bigint not null check(amount_minor>0),currency_code text not null,issued_at timestamptz not null default now(),unique(business_id,id),unique(business_id,refund_id),unique(business_id,receipt_number),
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,
 foreign key(business_id,refund_id) references public.refunds(business_id,id) on delete restrict
);

create trigger refund_requests_updated before update on public.refund_requests for each row execute function app.set_updated_at();
create trigger refunds_immutable before update or delete on public.refunds for each row execute function app.prevent_commercial_snapshot_change();
create trigger invoice_credits_immutable before update or delete on public.invoice_credits for each row execute function app.prevent_commercial_snapshot_change();
create trigger refund_receipts_immutable before update or delete on public.refund_receipts for each row execute function app.prevent_commercial_snapshot_change();

create or replace view public.invoice_balances with(security_invoker=true) as
select i.business_id,i.id invoice_id,
 v.total_minor,
 greatest(coalesce(p.paid_minor,0)-coalesce(r.refunded_minor,0),0)::bigint paid_minor,
 greatest((v.total_minor-coalesce(c.credit_minor,0))-(coalesce(p.paid_minor,0)-coalesce(r.refunded_minor,0)),0)::bigint balance_due_minor,
 greatest(v.deposit_required_minor-coalesce(c.credit_minor,0),0)::bigint deposit_required_minor,
 greatest(greatest(v.deposit_required_minor-coalesce(c.credit_minor,0),0)-greatest(coalesce(p.paid_minor,0)-coalesce(r.refunded_minor,0),0),0)::bigint deposit_due_minor,
 coalesce(c.credit_minor,0)::bigint credit_minor,
 greatest(v.total_minor-coalesce(c.credit_minor,0),0)::bigint net_total_minor,
 coalesce(r.refunded_minor,0)::bigint refunded_minor
from public.invoices i
join public.invoice_versions v on v.business_id=i.business_id and v.invoice_id=i.id and v.version_number=i.current_version_number
left join (select a.business_id,a.invoice_id,sum(a.amount_minor)::bigint paid_minor from public.payment_allocations a join public.payments p on p.business_id=a.business_id and p.id=a.payment_id and p.status='succeeded' group by a.business_id,a.invoice_id) p on p.business_id=i.business_id and p.invoice_id=i.id
left join (select business_id,invoice_id,sum(amount_minor)::bigint refunded_minor from public.refunds group by business_id,invoice_id) r on r.business_id=i.business_id and r.invoice_id=i.id
left join (select business_id,invoice_id,sum(amount_minor)::bigint credit_minor from public.invoice_credits group by business_id,invoice_id) c on c.business_id=i.business_id and c.invoice_id=i.id;

create or replace function app.create_refund_request(target_business_id uuid,target_payment_id uuid,amount_value bigint,reason_value text,request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing uuid;p public.payments%rowtype;refunded bigint;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'payments.refund') then raise exception 'refund unavailable' using errcode='42501';end if;
 select id into existing from public.refund_requests where business_id=target_business_id and idempotency_key=trim(request_key);if existing is not null then return existing;end if;
 select * into p from public.payments where business_id=target_business_id and id=target_payment_id for update;
 select coalesce(sum(amount_minor),0) into refunded from public.refunds where business_id=target_business_id and payment_id=target_payment_id;
 if p.id is null or p.status<>'succeeded' or amount_value<=0 or amount_value>p.amount_minor-refunded or char_length(trim(reason_value))<5 then raise exception 'refundable payment unavailable' using errcode='22023';end if;
 insert into public.refund_requests(business_id,payment_id,invoice_id,amount_minor,currency_code,reason,provider,status,idempotency_key,requested_by)
 values(target_business_id,p.id,p.invoice_id,amount_value,p.currency_code,trim(reason_value),case when p.provider='stripe' then 'stripe' else 'manual' end,'created',trim(request_key),auth.uid()) returning id into created_id;
 return created_id;
end;$$;

create or replace function app.finalize_refund_request(target_request_id uuid,provider_ref text,result_status text,failure_value text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare rr public.refund_requests%rowtype;p public.payments%rowtype;i public.invoices%rowtype;refund_id uuid;receipt_id uuid;bal public.invoice_balances%rowtype;
begin
 select * into rr from public.refund_requests where id=target_request_id for update;if rr.id is null then raise exception 'refund request unavailable' using errcode='P0002';end if;
 select id into refund_id from public.refunds where business_id=rr.business_id and refund_request_id=rr.id;if refund_id is not null then return refund_id;end if;
 if result_status not in('succeeded','failed','processing') then raise exception 'invalid refund result' using errcode='22023';end if;
 if result_status<>'succeeded' then update public.refund_requests set status=result_status,provider_reference=nullif(trim(provider_ref),''),failure_category=nullif(trim(failure_value),'') where id=rr.id;return null;end if;
 select * into p from public.payments where business_id=rr.business_id and id=rr.payment_id;select * into i from public.invoices where business_id=rr.business_id and id=rr.invoice_id;
 insert into public.refunds(business_id,refund_request_id,payment_id,invoice_id,amount_minor,currency_code,provider,provider_reference,reason)
 values(rr.business_id,rr.id,p.id,i.id,rr.amount_minor,rr.currency_code,rr.provider,nullif(trim(provider_ref),''),rr.reason) returning id into refund_id;
 insert into public.invoice_credits(business_id,invoice_id,refund_id,amount_minor,reason) values(rr.business_id,i.id,refund_id,rr.amount_minor,rr.reason);
 insert into public.refund_receipts(business_id,invoice_id,refund_id,receipt_number,amount_minor,currency_code) values(rr.business_id,i.id,refund_id,i.invoice_number||'-R'||substr(refund_id::text,1,8),rr.amount_minor,rr.currency_code) returning id into receipt_id;
 update public.refund_requests set status='succeeded',provider_reference=nullif(trim(provider_ref),''),failure_category=null where id=rr.id;
 select * into bal from public.invoice_balances where business_id=i.business_id and invoice_id=i.id;update public.invoices set status=case when bal.balance_due_minor=0 then 'paid' else 'partially_paid' end where id=i.id;
 insert into public.transactional_message_outbox(business_id,customer_id,booking_id,invoice_id,message_type,channel,template_data,idempotency_key)
 values(rr.business_id,i.customer_id,i.booking_id,i.id,'refund_issued','email',jsonb_build_object('refund_receipt_id',receipt_id,'invoice_number',i.invoice_number,'amount_minor',rr.amount_minor,'currency_code',rr.currency_code,'reason',rr.reason),'refund-receipt-'||refund_id::text);
 return refund_id;
end;$$;

create or replace function app.process_stripe_refund_event(target_event_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.processor_webhook_events%rowtype;payload jsonb;o jsonb;request_id uuid;refund_id uuid;status_value text;
begin
 select * into e from public.processor_webhook_events where id=target_event_id for update;if e.id is null or e.status not in('pending','failed') or e.event_type not in('refund.created','refund.updated','refund.failed') then raise exception 'processable refund event unavailable' using errcode='P0002';end if;
 select raw_payload into payload from public.processor_webhook_payloads where webhook_event_id=e.id;o:=payload#>'{data,object}';request_id:=nullif(o#>>'{metadata,petcare_refund_request_id}','')::uuid;status_value:=o->>'status';
 if request_id is null or not exists(select 1 from public.refund_requests where id=request_id and business_id=e.business_id and provider='stripe') then update public.processor_webhook_events set status='quarantined',quarantine_reason='refund_request_mismatch' where id=e.id;return null;end if;
 select app.finalize_refund_request(request_id,o->>'id',case when status_value='succeeded' then 'succeeded' when status_value='failed' or e.event_type='refund.failed' then 'failed' else 'processing' end,o->>'failure_reason') into refund_id;
 update public.processor_webhook_events set status='processed',processed_at=now(),attempt_count=attempt_count+1 where id=e.id;return refund_id;
end;$$;

do $$declare n text;begin foreach n in array array['refund_requests','refunds','invoice_credits','refund_receipts'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);end loop;end$$;
create policy refund_requests_view on public.refund_requests for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
create policy refunds_view on public.refunds for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
create policy invoice_credits_view on public.invoice_credits for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
create policy refund_receipts_view on public.refund_receipts for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
revoke all on public.refund_requests,public.refunds,public.invoice_credits,public.refund_receipts from anon,authenticated;
grant select on public.refund_requests,public.refunds,public.invoice_credits,public.refund_receipts to authenticated;
revoke all on function app.create_refund_request(uuid,uuid,bigint,text,text),app.finalize_refund_request(uuid,text,text,text),app.process_stripe_refund_event(uuid) from public;
grant execute on function app.create_refund_request(uuid,uuid,bigint,text,text) to authenticated;
grant execute on function app.finalize_refund_request(uuid,text,text,text),app.process_stripe_refund_event(uuid) to service_role;
