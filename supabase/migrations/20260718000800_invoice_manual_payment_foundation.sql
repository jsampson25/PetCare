-- PetCare E08 invoice, allocation, manual tender, receipt, and message-outbox foundation.

insert into public.permission_definitions(permission_key,description,risk_level) values
 ('payments.view','View invoices, payments, receipts, and balances.','sensitive') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
 ('owner','payments.view'),('manager','payments.view'),('front_desk','payments.view'),('accountant','payments.view') on conflict do nothing;

create table public.business_invoice_counters(
 business_id uuid primary key references public.businesses(id) on delete restrict,next_value bigint not null default 1 check(next_value>0)
);
create table public.invoices(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,customer_id uuid not null,booking_id uuid,
 invoice_number text not null,status text not null check(status in('draft','open','partially_paid','paid','void','uncollectible','corrected')),
 currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),current_version_number integer not null default 1 check(current_version_number>0),
 issued_at timestamptz,due_at timestamptz,idempotency_key text not null,created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(business_id,id),unique(business_id,invoice_number),unique(business_id,idempotency_key),
 foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict
);
create unique index invoice_one_booking_idx on public.invoices(business_id,booking_id) where booking_id is not null and status<>'void';
create index invoices_queue_idx on public.invoices(business_id,status,due_at,created_at);

create table public.invoice_versions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,invoice_id uuid not null,version_number integer not null,quote_id uuid,
 source_booking_revision_id uuid,subtotal_minor bigint not null check(subtotal_minor>=0),discount_minor bigint not null check(discount_minor>=0),
 fee_minor bigint not null check(fee_minor>=0),tax_minor bigint not null check(tax_minor>=0),total_minor bigint not null check(total_minor>=0),
 deposit_required_minor bigint not null check(deposit_required_minor>=0),reason text not null,created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,invoice_id,version_number),foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,
 foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete restrict,
 foreign key(business_id,source_booking_revision_id) references public.booking_revisions(business_id,id) on delete restrict,
 check(total_minor=subtotal_minor-discount_minor+fee_minor+tax_minor),check(deposit_required_minor<=total_minor)
);
create table public.invoice_lines(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,invoice_version_id uuid not null,source_quote_line_id uuid,
 line_type text not null check(line_type in('base','adjustment','discount','fee','tax','credit','write_off')),
 label text not null,quantity integer not null check(quantity>0),unit_amount_minor bigint not null,total_minor bigint not null,display_order integer not null,
 source_details jsonb not null default '{}'::jsonb check(jsonb_typeof(source_details)='object'),created_at timestamptz not null default now(),unique(business_id,id),
 foreign key(business_id,invoice_version_id) references public.invoice_versions(business_id,id) on delete restrict,
 foreign key(business_id,source_quote_line_id) references public.quote_lines(business_id,id) on delete restrict
);

create table public.payment_requests(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,invoice_id uuid not null,booking_id uuid,customer_id uuid not null,
 purpose text not null check(purpose in('deposit','balance','partial','manual')),amount_minor bigint not null check(amount_minor>0),currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
 status text not null check(status in('created','processing','action_required','succeeded','failed','cancelled')),
 provider text not null check(provider in('manual','stripe')),provider_reference text,idempotency_key text not null,failure_category text,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
 foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict
);
create table public.payments(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,payment_request_id uuid not null,invoice_id uuid not null,location_id uuid not null,
 amount_minor bigint not null check(amount_minor>0),currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
 tender_type text not null check(tender_type in('cash','check','external_card','stripe_card','digital_wallet')),
 status text not null check(status in('succeeded','voided','disputed')),provider text not null,provider_reference text,manual_reference text,
 collected_by uuid not null references auth.users(id) on delete restrict default auth.uid(),collected_at timestamptz not null default now(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,payment_request_id),foreign key(business_id,payment_request_id) references public.payment_requests(business_id,id) on delete restrict,
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,
 foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict
);
create table public.payment_allocations(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,payment_id uuid not null,invoice_id uuid not null,amount_minor bigint not null check(amount_minor>0),
 allocation_type text not null check(allocation_type in('deposit','balance','partial')),created_at timestamptz not null default now(),unique(business_id,id),
 foreign key(business_id,payment_id) references public.payments(business_id,id) on delete restrict,foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict
);
create table public.receipts(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,invoice_id uuid not null,payment_id uuid not null,receipt_number text not null,
 amount_minor bigint not null check(amount_minor>0),currency_code text not null,issued_at timestamptz not null default now(),unique(business_id,id),unique(business_id,receipt_number),
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,foreign key(business_id,payment_id) references public.payments(business_id,id) on delete restrict
);
create table public.transactional_message_outbox(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,customer_id uuid not null,booking_id uuid,invoice_id uuid,
 message_type text not null check(message_type in('invoice_issued','payment_receipt','payment_failed','refund_issued','booking_confirmed')),
 channel text not null check(channel in('email','sms','push','in_app')),status text not null default 'pending' check(status in('pending','processing','sent','failed','suppressed')),
 template_data jsonb not null check(jsonb_typeof(template_data)='object'),idempotency_key text not null,attempt_count integer not null default 0 check(attempt_count>=0),
 next_attempt_at timestamptz not null default now(),last_error_category text,created_at timestamptz not null default now(),sent_at timestamptz,
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict
);
create index message_outbox_pending_idx on public.transactional_message_outbox(status,next_attempt_at) where status in('pending','failed');

create or replace view public.invoice_balances with(security_invoker=true) as
select i.business_id,i.id invoice_id,v.total_minor,coalesce(sum(a.amount_minor) filter(where p.status='succeeded'),0)::bigint paid_minor,
 greatest(v.total_minor-coalesce(sum(a.amount_minor) filter(where p.status='succeeded'),0),0)::bigint balance_due_minor,
 v.deposit_required_minor,greatest(v.deposit_required_minor-coalesce(sum(a.amount_minor) filter(where p.status='succeeded'),0),0)::bigint deposit_due_minor
from public.invoices i join public.invoice_versions v on v.business_id=i.business_id and v.invoice_id=i.id and v.version_number=i.current_version_number
left join public.payment_allocations a on a.business_id=i.business_id and a.invoice_id=i.id left join public.payments p on p.business_id=a.business_id and p.id=a.payment_id
group by i.business_id,i.id,v.total_minor,v.deposit_required_minor;

create trigger invoices_updated before update on public.invoices for each row execute function app.set_updated_at();
create trigger payment_requests_updated before update on public.payment_requests for each row execute function app.set_updated_at();
create trigger invoices_tenant before update on public.invoices for each row execute function app.prevent_business_id_change();
create trigger invoice_versions_immutable before update or delete on public.invoice_versions for each row execute function app.prevent_commercial_snapshot_change();
create trigger invoice_lines_immutable before update or delete on public.invoice_lines for each row execute function app.prevent_commercial_snapshot_change();
create trigger payments_immutable before update or delete on public.payments for each row execute function app.prevent_commercial_snapshot_change();
create trigger allocations_immutable before update or delete on public.payment_allocations for each row execute function app.prevent_commercial_snapshot_change();
create trigger receipts_immutable before update or delete on public.receipts for each row execute function app.prevent_commercial_snapshot_change();
create trigger invoices_audit after insert or update or delete on public.invoices for each row execute function app.audit_configuration_change('invoice.changed','invoice');

create or replace function app.next_invoice_number(target_business_id uuid) returns text language plpgsql security definer set search_path='' as $$declare allocated bigint;begin
 insert into public.business_invoice_counters(business_id,next_value) values(target_business_id,2) on conflict(business_id) do update set next_value=public.business_invoice_counters.next_value+1 returning next_value-1 into allocated;
 if allocated is null then allocated:=1;end if;return 'INV-'||lpad(allocated::text,6,'0');end;$$;

create or replace function app.issue_booking_invoice(target_business_id uuid,target_booking_id uuid,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;b public.bookings%rowtype;r public.booking_revisions%rowtype;q public.quotes%rowtype;invoice_id uuid;version_id uuid;number_value text;
begin
 if not app.member_has_permission(target_business_id,'payments.collect') then raise exception 'invoice issuance unavailable' using errcode='42501';end if;
 select id into existing from public.invoices where business_id=target_business_id and idempotency_key=trim(request_key);if existing is not null then return existing;end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id;
 if b.id is null or b.status in('draft','expired') or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'billable booking unavailable' using errcode='P0002';end if;
 select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 select * into q from public.quotes where business_id=target_business_id and id=r.quote_id;
 number_value:=app.next_invoice_number(target_business_id);
 insert into public.invoices(business_id,location_id,customer_id,booking_id,invoice_number,status,currency_code,issued_at,due_at,idempotency_key)
 values(target_business_id,b.location_id,b.customer_id,b.id,number_value,'open',q.currency_code,now(),case when b.status='pending_deposit' then now() else q.ends_at end,trim(request_key)) returning id into invoice_id;
 insert into public.invoice_versions(business_id,invoice_id,version_number,quote_id,source_booking_revision_id,subtotal_minor,discount_minor,fee_minor,tax_minor,total_minor,deposit_required_minor,reason)
 values(target_business_id,invoice_id,1,q.id,r.id,q.subtotal_minor,q.discount_minor,q.fee_minor,q.tax_minor,q.total_minor,q.deposit_due_minor,'Initial invoice from accepted booking quote') returning id into version_id;
 insert into public.invoice_lines(business_id,invoice_version_id,source_quote_line_id,line_type,label,quantity,unit_amount_minor,total_minor,display_order,source_details)
 select business_id,version_id,id,line_type,label,greatest(quantity,1),case when quantity=0 then total_minor else total_minor/quantity end,total_minor,display_order,jsonb_build_object('explanation',explanation,'quote_id',q.id) from public.quote_lines where business_id=target_business_id and quote_id=q.id order by display_order;
 insert into public.transactional_message_outbox(business_id,customer_id,booking_id,invoice_id,message_type,channel,template_data,idempotency_key)
 values(target_business_id,b.customer_id,b.id,invoice_id,'invoice_issued','email',jsonb_build_object('invoice_number',number_value,'total_minor',q.total_minor,'currency_code',q.currency_code),'invoice-issued-'||invoice_id::text);
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'invoice.issued',true,'Invoice issued.',jsonb_build_object('invoice_id',invoice_id,'invoice_number',number_value),auth.uid());
 return invoice_id;
end;$$;

create or replace function app.record_manual_payment(target_business_id uuid,target_invoice_id uuid,target_location_id uuid,amount_value bigint,tender_value text,reference_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;i public.invoices%rowtype;bal public.invoice_balances%rowtype;request_id uuid;payment_id uuid;receipt_id uuid;allocation_kind text;booking_status text;
begin
 if not app.member_has_permission(target_business_id,'payments.collect') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'payment collection unavailable' using errcode='42501';end if;
 select id into existing from public.payments where business_id=target_business_id and payment_request_id=(select id from public.payment_requests where business_id=target_business_id and idempotency_key=trim(request_key));if existing is not null then return existing;end if;
 select * into i from public.invoices where business_id=target_business_id and id=target_invoice_id for update;
 select * into bal from public.invoice_balances where business_id=target_business_id and invoice_id=i.id;
 if i.id is null or i.location_id<>target_location_id or i.status not in('open','partially_paid') or amount_value<=0 or amount_value>bal.balance_due_minor or tender_value not in('cash','check','external_card') then raise exception 'collectible invoice unavailable' using errcode='22023';end if;
 if tender_value in('check','external_card') and char_length(trim(reference_value))<4 then raise exception 'manual payment reference required' using errcode='22023';end if;
 allocation_kind:=case when bal.paid_minor=0 and amount_value<=bal.deposit_required_minor then 'deposit' when amount_value=bal.balance_due_minor then 'balance' else 'partial' end;
 insert into public.payment_requests(business_id,invoice_id,booking_id,customer_id,purpose,amount_minor,currency_code,status,provider,provider_reference,idempotency_key)
 values(target_business_id,i.id,i.booking_id,i.customer_id,case when allocation_kind='deposit' then 'deposit' when allocation_kind='balance' then 'balance' else 'partial' end,amount_value,i.currency_code,'succeeded','manual',nullif(trim(reference_value),''),trim(request_key)) returning id into request_id;
 insert into public.payments(business_id,payment_request_id,invoice_id,location_id,amount_minor,currency_code,tender_type,status,provider,manual_reference)
 values(target_business_id,request_id,i.id,target_location_id,amount_value,i.currency_code,tender_value,'succeeded','manual',nullif(trim(reference_value),'')) returning id into payment_id;
 insert into public.payment_allocations(business_id,payment_id,invoice_id,amount_minor,allocation_type) values(target_business_id,payment_id,i.id,amount_value,allocation_kind);
 select * into bal from public.invoice_balances where business_id=target_business_id and invoice_id=i.id;
 update public.invoices set status=case when bal.balance_due_minor=0 then 'paid' else 'partially_paid' end where id=i.id;
 insert into public.receipts(business_id,invoice_id,payment_id,receipt_number,amount_minor,currency_code) values(target_business_id,i.id,payment_id,i.invoice_number||'-P'||substr(payment_id::text,1,8),amount_value,i.currency_code) returning id into receipt_id;
 insert into public.transactional_message_outbox(business_id,customer_id,booking_id,invoice_id,message_type,channel,template_data,idempotency_key)
 values(target_business_id,i.customer_id,i.booking_id,i.id,'payment_receipt','email',jsonb_build_object('receipt_id',receipt_id,'invoice_number',i.invoice_number,'amount_minor',amount_value,'currency_code',i.currency_code),'payment-receipt-'||payment_id::text);
 if i.booking_id is not null then
   select status into booking_status from public.bookings where business_id=target_business_id and id=i.booking_id;
   if booking_status='pending_deposit' and bal.deposit_due_minor=0 then
     perform app.confirm_booking_deposit(target_business_id,i.booking_id,payment_id::text,'ledger-deposit-'||payment_id::text);
     update public.booking_action_items set status='resolved',resolved_by=auth.uid(),resolved_at=now() where business_id=target_business_id and booking_id=i.booking_id and action_type='deposit' and status='open';
   end if;
 end if;
 return payment_id;
end;$$;

do $$declare n text;begin foreach n in array array['business_invoice_counters','invoices','invoice_versions','invoice_lines','payment_requests','payments','payment_allocations','receipts','transactional_message_outbox'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);end loop;end$$;
create policy invoices_view on public.invoices for select to authenticated using(app.member_has_permission(business_id,'payments.view') and app.member_can_access_location(business_id,location_id));
create policy invoice_versions_view on public.invoice_versions for select to authenticated using(app.member_has_permission(business_id,'payments.view') and exists(select 1 from public.invoices i where i.business_id=invoice_versions.business_id and i.id=invoice_versions.invoice_id and app.member_can_access_location(i.business_id,i.location_id)));
create policy invoice_lines_view on public.invoice_lines for select to authenticated using(app.member_has_permission(business_id,'payments.view') and exists(select 1 from public.invoice_versions v join public.invoices i on i.business_id=v.business_id and i.id=v.invoice_id where v.business_id=invoice_lines.business_id and v.id=invoice_lines.invoice_version_id and app.member_can_access_location(i.business_id,i.location_id)));
create policy payment_requests_view on public.payment_requests for select to authenticated using(app.member_has_permission(business_id,'payments.view') and exists(select 1 from public.invoices i where i.business_id=payment_requests.business_id and i.id=payment_requests.invoice_id and app.member_can_access_location(i.business_id,i.location_id)));
create policy payments_view on public.payments for select to authenticated using(app.member_has_permission(business_id,'payments.view') and app.member_can_access_location(business_id,location_id));
create policy allocations_view on public.payment_allocations for select to authenticated using(app.member_has_permission(business_id,'payments.view') and exists(select 1 from public.invoices i where i.business_id=payment_allocations.business_id and i.id=payment_allocations.invoice_id and app.member_can_access_location(i.business_id,i.location_id)));
create policy receipts_view on public.receipts for select to authenticated using(app.member_has_permission(business_id,'payments.view') and exists(select 1 from public.invoices i where i.business_id=receipts.business_id and i.id=receipts.invoice_id and app.member_can_access_location(i.business_id,i.location_id)));
create policy outbox_view on public.transactional_message_outbox for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
revoke all on public.business_invoice_counters,public.invoices,public.invoice_versions,public.invoice_lines,public.payment_requests,public.payments,public.payment_allocations,public.receipts,public.transactional_message_outbox from anon,authenticated;
grant select on public.invoices,public.invoice_versions,public.invoice_lines,public.invoice_balances,public.payment_requests,public.payments,public.payment_allocations,public.receipts,public.transactional_message_outbox to authenticated;
revoke all on function app.next_invoice_number(uuid),app.issue_booking_invoice(uuid,uuid,text),app.record_manual_payment(uuid,uuid,uuid,bigint,text,text,text) from public;
grant execute on function app.issue_booking_invoice(uuid,uuid,text),app.record_manual_payment(uuid,uuid,uuid,bigint,text,text,text) to authenticated;
