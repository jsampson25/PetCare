-- PetCare E08 Stripe dispute correlation and operator reconciliation queue.
create table public.payment_disputes(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,payment_id uuid not null,invoice_id uuid not null,
 provider text not null check(provider='stripe'),provider_dispute_id text not null,provider_charge_id text,
 amount_minor bigint not null check(amount_minor>0),currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
 status text not null,reason text,evidence_due_at timestamptz,has_evidence boolean not null default false,submission_count integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(business_id,id),unique(provider,provider_dispute_id),
 foreign key(business_id,payment_id) references public.payments(business_id,id) on delete restrict,
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict
);
create table public.reconciliation_findings(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,payment_id uuid,invoice_id uuid,webhook_event_id uuid,
 finding_type text not null check(finding_type in('payment_disputed','amount_mismatch','currency_mismatch','provider_object_unmapped')),
 provider_reference text not null,expected_amount_minor bigint,actual_amount_minor bigint,currency_code text,
 status text not null default 'open' check(status in('open','resolved')),resolution_notes text,resolved_by uuid references auth.users(id) on delete restrict,resolved_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(business_id,id),unique(business_id,finding_type,provider_reference),
 foreign key(business_id,payment_id) references public.payments(business_id,id) on delete restrict,
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict,
 foreign key(webhook_event_id) references public.processor_webhook_events(id) on delete restrict,
 check((status='resolved')=(resolved_at is not null))
);
create index reconciliation_open_idx on public.reconciliation_findings(business_id,created_at) where status='open';
create trigger payment_disputes_updated before update on public.payment_disputes for each row execute function app.set_updated_at();
create trigger reconciliation_findings_updated before update on public.reconciliation_findings for each row execute function app.set_updated_at();

create or replace function app.process_stripe_dispute_event(target_event_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.processor_webhook_events%rowtype;payload jsonb;o jsonb;p public.payments%rowtype;dispute_id uuid;intent_ref text;due_epoch bigint;currency_value text;amount_value bigint;
begin
 select * into e from public.processor_webhook_events where id=target_event_id for update;
 if e.status='processed' then select id into dispute_id from public.payment_disputes where provider='stripe' and provider_dispute_id=e.provider_object_id;return dispute_id;end if;
 if e.id is null or e.status not in('pending','failed') or e.event_type not like 'charge.dispute.%' or e.business_id is null then raise exception 'processable dispute event unavailable' using errcode='P0002';end if;
 select raw_payload into payload from public.processor_webhook_payloads where webhook_event_id=e.id;o:=payload#>'{data,object}';intent_ref:=o->>'payment_intent';currency_value:=upper(o->>'currency');amount_value:=(o->>'amount')::bigint;
 select * into p from public.payments where business_id=e.business_id and provider='stripe' and provider_reference=intent_ref;
 if p.id is null then
   insert into public.reconciliation_findings(business_id,webhook_event_id,finding_type,provider_reference,actual_amount_minor,currency_code)
   values(e.business_id,e.id,'provider_object_unmapped',coalesce(nullif(intent_ref,''),o->>'id'),amount_value,currency_value) on conflict do nothing;
   update public.processor_webhook_events set status='quarantined',quarantine_reason='dispute_payment_unmapped',attempt_count=attempt_count+1 where id=e.id;return null;
 end if;
 due_epoch:=nullif(o#>>'{evidence_details,due_by}','')::bigint;
 insert into public.payment_disputes(business_id,payment_id,invoice_id,provider,provider_dispute_id,provider_charge_id,amount_minor,currency_code,status,reason,evidence_due_at,has_evidence,submission_count)
 values(e.business_id,p.id,p.invoice_id,'stripe',o->>'id',o->>'charge',amount_value,currency_value,o->>'status',o->>'reason',case when due_epoch>0 then to_timestamp(due_epoch) end,coalesce((o#>>'{evidence_details,has_evidence}')::boolean,false),coalesce((o#>>'{evidence_details,submission_count}')::integer,0))
 on conflict(provider,provider_dispute_id) do update set status=excluded.status,reason=excluded.reason,evidence_due_at=excluded.evidence_due_at,has_evidence=excluded.has_evidence,submission_count=excluded.submission_count,updated_at=now() returning id into dispute_id;
 if amount_value>p.amount_minor then insert into public.reconciliation_findings(business_id,payment_id,invoice_id,webhook_event_id,finding_type,provider_reference,expected_amount_minor,actual_amount_minor,currency_code)
 values(e.business_id,p.id,p.invoice_id,e.id,'amount_mismatch',o->>'id',p.amount_minor,amount_value,currency_value) on conflict do nothing;
 elsif currency_value<>p.currency_code then insert into public.reconciliation_findings(business_id,payment_id,invoice_id,webhook_event_id,finding_type,provider_reference,expected_amount_minor,actual_amount_minor,currency_code)
 values(e.business_id,p.id,p.invoice_id,e.id,'currency_mismatch',o->>'id',p.amount_minor,amount_value,currency_value) on conflict do nothing;
 elsif (o->>'status') not in('won','prevented') then insert into public.reconciliation_findings(business_id,payment_id,invoice_id,webhook_event_id,finding_type,provider_reference,expected_amount_minor,actual_amount_minor,currency_code)
 values(e.business_id,p.id,p.invoice_id,e.id,'payment_disputed',o->>'id',p.amount_minor,amount_value,currency_value) on conflict do nothing;end if;
 update public.processor_webhook_events set status='processed',processed_at=now(),attempt_count=attempt_count+1 where id=e.id;return dispute_id;
end;$$;

create or replace function app.resolve_reconciliation_finding(target_business_id uuid,target_finding_id uuid,notes_value text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not app.member_has_permission(target_business_id,'payments.manage') or char_length(trim(notes_value))<5 then raise exception 'finding resolution unavailable' using errcode='42501';end if;
 update public.reconciliation_findings set status='resolved',resolution_notes=trim(notes_value),resolved_by=auth.uid(),resolved_at=now()
 where business_id=target_business_id and id=target_finding_id and status='open';if not found then raise exception 'open finding unavailable' using errcode='P0002';end if;
end;$$;

alter table public.payment_disputes enable row level security;alter table public.payment_disputes force row level security;
alter table public.reconciliation_findings enable row level security;alter table public.reconciliation_findings force row level security;
create policy payment_disputes_view on public.payment_disputes for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
create policy reconciliation_findings_view on public.reconciliation_findings for select to authenticated using(app.member_has_permission(business_id,'payments.manage'));
revoke all on public.payment_disputes,public.reconciliation_findings from anon,authenticated;
grant select on public.payment_disputes,public.reconciliation_findings to authenticated;
revoke all on function app.process_stripe_dispute_event(uuid),app.resolve_reconciliation_finding(uuid,uuid,text) from public;
grant execute on function app.process_stripe_dispute_event(uuid) to service_role;
grant execute on function app.resolve_reconciliation_finding(uuid,uuid,text) to authenticated;
