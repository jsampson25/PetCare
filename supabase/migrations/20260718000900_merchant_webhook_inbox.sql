-- PetCare E08 merchant context and verified processor webhook inbox.
insert into public.permission_definitions(permission_key,description,risk_level) values
 ('payments.manage','Manage merchant connection and payment settings.','high') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values('owner','payments.manage') on conflict do nothing;

create table public.merchant_accounts(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,provider text not null check(provider='stripe'),provider_account_id text not null check(provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
 status text not null default 'pending' check(status in('pending','restricted','active','disabled','disconnected')),
 charges_enabled boolean not null default false,payouts_enabled boolean not null default false,details_submitted boolean not null default false,
 dashboard_access text not null default 'express' check(dashboard_access in('full','express','none')),
 requirements_collector text not null default 'stripe' check(requirements_collector in('stripe','application')),
 fees_payer text not null default 'account' check(fees_payer in('account','application')),losses_payer text not null default 'stripe' check(losses_payer in('stripe','application')),
 capability_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(capability_snapshot)='object'),last_synced_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,provider),unique(provider,provider_account_id),foreign key(business_id) references public.businesses(id) on delete restrict
);
create table public.processor_webhook_events(
 id uuid primary key default gen_random_uuid(),business_id uuid,merchant_account_id uuid,provider text not null check(provider='stripe'),provider_event_id text not null,
 event_type text not null,provider_account_id text,provider_object_id text,api_version text,livemode boolean not null,
 status text not null check(status in('pending','processing','processed','ignored','failed','quarantined')),
 quarantine_reason text,payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),signature_timestamp bigint not null,
 attempt_count integer not null default 0 check(attempt_count>=0),next_attempt_at timestamptz not null default now(),last_error_category text,
 received_at timestamptz not null default now(),processed_at timestamptz,created_at timestamptz not null default now(),
 unique(provider,provider_event_id),unique(business_id,id),foreign key(business_id,merchant_account_id) references public.merchant_accounts(business_id,id) on delete restrict,
 check((status='quarantined')=(quarantine_reason is not null))
);
create index processor_webhook_work_idx on public.processor_webhook_events(status,next_attempt_at) where status in('pending','failed');
create table public.processor_webhook_payloads(
 webhook_event_id uuid primary key references public.processor_webhook_events(id) on delete restrict,raw_payload jsonb not null check(jsonb_typeof(raw_payload)='object'),created_at timestamptz not null default now()
);

create trigger merchant_accounts_updated before update on public.merchant_accounts for each row execute function app.set_updated_at();
create trigger merchant_accounts_tenant before update on public.merchant_accounts for each row execute function app.prevent_business_id_change();
create trigger merchant_accounts_audit after insert or update or delete on public.merchant_accounts for each row execute function app.audit_configuration_change('merchant.connection.changed','merchant_account');

create or replace function app.configure_stripe_merchant_account(target_business_id uuid,account_reference text,dashboard_value text)
returns uuid language plpgsql security definer set search_path='' as $$declare created_id uuid;begin
 if trim(account_reference)!~'^acct_[A-Za-z0-9]+$' or dashboard_value not in('full','express') then raise exception 'invalid merchant account reference' using errcode='22023';end if;
 insert into public.merchant_accounts(business_id,provider,provider_account_id,dashboard_access,requirements_collector,fees_payer,losses_payer)
 values(target_business_id,'stripe',trim(account_reference),dashboard_value,'stripe','account','stripe')
 on conflict(business_id,provider) do update set provider_account_id=excluded.provider_account_id,dashboard_access=excluded.dashboard_access,status='pending',charges_enabled=false,payouts_enabled=false,details_submitted=false,last_synced_at=null
 returning id into created_id;return created_id;end;$$;

create or replace function app.ingest_stripe_webhook(event_identifier text,event_name text,account_reference text,object_identifier text,version_value text,is_live boolean,payload_value jsonb,payload_hash text,signature_time bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;merchant public.merchant_accounts%rowtype;created_id uuid;event_status text;reason_value text;
begin
 select id into existing from public.processor_webhook_events where provider='stripe' and provider_event_id=trim(event_identifier);if existing is not null then return existing;end if;
 if trim(event_identifier)='' or trim(event_name)='' or jsonb_typeof(payload_value)<>'object' or payload_hash!~'^[a-f0-9]{64}$' then raise exception 'invalid verified webhook envelope' using errcode='22023';end if;
 select * into merchant from public.merchant_accounts where provider='stripe' and provider_account_id=nullif(trim(account_reference),'');
 if merchant.id is null then event_status:='quarantined';reason_value:='merchant_account_unmapped';
 elsif merchant.status in('disabled','disconnected') then event_status:='quarantined';reason_value:='merchant_account_inactive';
 else event_status:='pending';reason_value:=null;end if;
 insert into public.processor_webhook_events(business_id,merchant_account_id,provider,provider_event_id,event_type,provider_account_id,provider_object_id,api_version,livemode,status,quarantine_reason,payload_sha256,signature_timestamp)
 values(merchant.business_id,merchant.id,'stripe',trim(event_identifier),trim(event_name),nullif(trim(account_reference),''),nullif(trim(object_identifier),''),nullif(trim(version_value),''),is_live,event_status,reason_value,payload_hash,signature_time)
 returning id into created_id;
 insert into public.processor_webhook_payloads(webhook_event_id,raw_payload) values(created_id,payload_value);
 return created_id;end;$$;

alter table public.merchant_accounts enable row level security;alter table public.merchant_accounts force row level security;
alter table public.processor_webhook_events enable row level security;alter table public.processor_webhook_events force row level security;
alter table public.processor_webhook_payloads enable row level security;alter table public.processor_webhook_payloads force row level security;
create policy merchant_accounts_view on public.merchant_accounts for select to authenticated using(app.member_has_permission(business_id,'payments.view'));
create policy processor_webhooks_view on public.processor_webhook_events for select to authenticated using(business_id is not null and app.member_has_permission(business_id,'payments.manage'));
revoke all on public.merchant_accounts,public.processor_webhook_events,public.processor_webhook_payloads from anon,authenticated;
grant select on public.merchant_accounts,public.processor_webhook_events to authenticated;
revoke all on function app.configure_stripe_merchant_account(uuid,text,text),app.ingest_stripe_webhook(text,text,text,text,text,boolean,jsonb,text,bigint) from public;
grant execute on function app.configure_stripe_merchant_account(uuid,text,text) to service_role;
grant execute on function app.ingest_stripe_webhook(text,text,text,text,text,boolean,jsonb,text,bigint) to service_role;
