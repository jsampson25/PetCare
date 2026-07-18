-- PetCare E06 deterministic pricing, policy, agreement, and quote foundation.
insert into public.permission_definitions(permission_key,description,risk_level) values
('pricing.view','View price books, policies, and quotes.','sensitive'),
('pricing.manage','Configure and publish commercial terms.','high'),
('quotes.create','Calculate customer or staff quotes.','standard');
insert into public.role_permissions(role_key,permission_key) values
('owner','pricing.view'),('owner','pricing.manage'),('owner','quotes.create'),
('manager','pricing.view'),('manager','pricing.manage'),('manager','quotes.create'),
('front_desk','pricing.view'),('front_desk','quotes.create'),('accountant','pricing.view');

create table public.price_books(
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete restrict,
 name text not null check(char_length(trim(name)) between 1 and 120),currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
 status text not null default 'draft' check(status in('draft','active','retired','archived')),
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,name)
);
create table public.price_book_versions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,price_book_id uuid not null,version_number integer not null check(version_number>0),
 status text not null default 'draft' check(status in('draft','published','superseded','retired')),effective_from date,
 published_at timestamptz,published_by uuid references auth.users(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,price_book_id,version_number),foreign key(business_id,price_book_id) references public.price_books(business_id,id) on delete restrict,
 check((status in('published','superseded','retired'))=(published_at is not null and published_by is not null))
);
create unique index price_book_one_published_idx on public.price_book_versions(business_id,price_book_id) where status='published';
create table public.price_rate_rules(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,price_book_version_id uuid not null,location_id uuid not null,service_version_id uuid not null,
 charge_unit text not null check(charge_unit in('night','day','appointment','pet','booking','occurrence','quantity')),
 amount_minor bigint not null check(amount_minor>=0),priority integer not null default 100,starts_on date,ends_on date,
 day_of_week smallint check(day_of_week between 0 and 6),label text not null check(char_length(trim(label)) between 1 and 160),
 created_at timestamptz not null default now(),unique(business_id,id),
 foreign key(business_id,price_book_version_id) references public.price_book_versions(business_id,id) on delete restrict,
 foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,service_version_id) references public.service_versions(business_id,id) on delete restrict,
 check(ends_on is null or starts_on is not null),check(ends_on is null or ends_on>=starts_on)
);
create index price_rate_lookup_idx on public.price_rate_rules(business_id,location_id,service_version_id,priority,starts_on,ends_on);
create table public.commercial_policy_versions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,name text not null,
 version_number integer not null,status text not null default 'draft' check(status in('draft','published','superseded','retired')),
 deposit_type text not null check(deposit_type in('none','fixed','percentage','full')),
 deposit_value integer not null default 0 check(deposit_value>=0),deposit_minimum_minor bigint not null default 0 check(deposit_minimum_minor>=0),deposit_maximum_minor bigint check(deposit_maximum_minor is null or deposit_maximum_minor>=0),
 tax_rate_bps integer not null default 0 check(tax_rate_bps between 0 and 10000),balance_due_timing text not null default 'check_in' check(balance_due_timing in('booking','before_arrival','check_in','check_out')),
 cancellation_notice_hours integer not null default 24 check(cancellation_notice_hours>=0),late_cancellation_fee_minor bigint not null default 0 check(late_cancellation_fee_minor>=0),no_show_fee_minor bigint not null default 0 check(no_show_fee_minor>=0),
 agreement_title text not null,agreement_body text not null,customer_summary text not null,
 published_at timestamptz,published_by uuid references auth.users(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,location_id,name,version_number),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 check((status in('published','superseded','retired'))=(published_at is not null and published_by is not null)),
 check(deposit_type<>'percentage' or deposit_value<=10000),check(deposit_maximum_minor is null or deposit_maximum_minor>=deposit_minimum_minor)
);
create unique index commercial_policy_one_published_idx on public.commercial_policy_versions(business_id,location_id) where status='published';

create table public.quotes(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,customer_id uuid,pet_id uuid not null,service_version_id uuid not null,
 price_book_version_id uuid not null,policy_version_id uuid not null,currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
 starts_at timestamptz not null,ends_at timestamptz not null,quantity integer not null check(quantity>0),charge_units integer not null check(charge_units>0),
 subtotal_minor bigint not null,discount_minor bigint not null default 0,fee_minor bigint not null default 0,tax_minor bigint not null,total_minor bigint not null,deposit_due_minor bigint not null,balance_due_minor bigint not null,
 status text not null default 'valid' check(status in('valid','expired','superseded','accepted')),expires_at timestamptz not null,idempotency_key text not null,
 calculation_trace jsonb not null check(jsonb_typeof(calculation_trace)='object'),created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),
 foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 foreign key(business_id,service_version_id) references public.service_versions(business_id,id) on delete restrict,
 foreign key(business_id,price_book_version_id) references public.price_book_versions(business_id,id) on delete restrict,
 foreign key(business_id,policy_version_id) references public.commercial_policy_versions(business_id,id) on delete restrict,
 check(ends_at>starts_at),check(subtotal_minor>=0 and discount_minor>=0 and fee_minor>=0 and tax_minor>=0 and total_minor>=0 and deposit_due_minor>=0 and balance_due_minor>=0),
 check(total_minor=subtotal_minor-discount_minor+fee_minor+tax_minor),check(balance_due_minor=total_minor-deposit_due_minor)
);
create table public.quote_lines(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,quote_id uuid not null,line_type text not null check(line_type in('base','adjustment','discount','fee','tax')),
 label text not null,quantity integer not null,unit_amount_minor bigint not null,total_minor bigint not null,source_rule_id uuid,explanation text not null,display_order integer not null,
 created_at timestamptz not null default now(),unique(business_id,id),foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete restrict
);
create table public.agreement_acceptances(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,quote_id uuid not null,policy_version_id uuid not null,
 actor_identity_id uuid not null references auth.users(id) on delete restrict,acceptance_scope text not null default 'quote',accepted_at timestamptz not null default now(),
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),unique(business_id,id),unique(business_id,quote_id,policy_version_id,actor_identity_id),
 foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete restrict,
 foreign key(business_id,policy_version_id) references public.commercial_policy_versions(business_id,id) on delete restrict
);

create or replace function app.prevent_commercial_snapshot_change() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'commercial snapshot is immutable' using errcode='23514'; end; $$;
create trigger quotes_immutable before update or delete on public.quotes for each row execute function app.prevent_commercial_snapshot_change();
create trigger quote_lines_immutable before update or delete on public.quote_lines for each row execute function app.prevent_commercial_snapshot_change();
create trigger agreement_acceptances_immutable before update or delete on public.agreement_acceptances for each row execute function app.prevent_commercial_snapshot_change();
create or replace function app.prevent_published_commercial_change() returns trigger language plpgsql set search_path='' as $$
begin if old.status<>'draft' then raise exception 'published commercial configuration is immutable' using errcode='23514'; end if; return new; end; $$;
create trigger price_versions_immutable before update or delete on public.price_book_versions for each row execute function app.prevent_published_commercial_change();
create trigger policy_versions_immutable before update or delete on public.commercial_policy_versions for each row execute function app.prevent_published_commercial_change();
create trigger price_books_updated before update on public.price_books for each row execute function app.set_updated_at();
create trigger price_books_tenant before update on public.price_books for each row execute function app.prevent_business_id_change();
create trigger price_books_audit after insert or update or delete on public.price_books for each row execute function app.audit_configuration_change('pricing.book_changed','price_book');
create trigger policy_audit after insert or update or delete on public.commercial_policy_versions for each row execute function app.audit_configuration_change('pricing.policy_changed','commercial_policy_version');

create or replace function app.create_pricing_bundle(
 target_business_id uuid,target_location_id uuid,book_name text,currency text,policy_name text,
 deposit_kind text,deposit_amount integer,tax_bps integer,cancellation_hours integer,cancellation_fee bigint,no_show_fee bigint,
 agreement_name text,agreement_text text,summary_text text
) returns table(price_book_id uuid,price_book_version_id uuid,policy_version_id uuid) language plpgsql security definer set search_path='' as $$
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 insert into public.price_books(business_id,name,currency_code) values(target_business_id,trim(book_name),upper(currency)) returning id into price_book_id;
 insert into public.price_book_versions(business_id,price_book_id,version_number) values(target_business_id,price_book_id,1) returning id into price_book_version_id;
 insert into public.commercial_policy_versions(business_id,location_id,name,version_number,deposit_type,deposit_value,tax_rate_bps,cancellation_notice_hours,late_cancellation_fee_minor,no_show_fee_minor,agreement_title,agreement_body,customer_summary)
 values(target_business_id,target_location_id,trim(policy_name),1,deposit_kind,deposit_amount,tax_bps,cancellation_hours,cancellation_fee,no_show_fee,trim(agreement_name),trim(agreement_text),trim(summary_text)) returning id into policy_version_id;
 return next;
end; $$;
create or replace function app.add_price_rate(
 target_business_id uuid,target_price_version_id uuid,target_location_id uuid,target_service_version_id uuid,
 unit_value text,amount_value bigint,label_value text,priority_value integer,start_date date default null,end_date date default null
) returns uuid language plpgsql security definer set search_path='' as $$ declare created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.price_book_versions where business_id=target_business_id and id=target_price_version_id and status='draft') then raise exception 'draft price book unavailable' using errcode='P0002'; end if;
 insert into public.price_rate_rules(business_id,price_book_version_id,location_id,service_version_id,charge_unit,amount_minor,label,priority,starts_on,ends_on)
 values(target_business_id,target_price_version_id,target_location_id,target_service_version_id,unit_value,amount_value,trim(label_value),priority_value,start_date,end_date) returning id into created_id;return created_id;
end; $$;
create or replace function app.publish_pricing_bundle(target_business_id uuid,target_price_version_id uuid,target_policy_version_id uuid,effective_date date)
returns void language plpgsql security definer set search_path='' as $$ declare book_id uuid;location uuid;
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 select price_book_id into book_id from public.price_book_versions where business_id=target_business_id and id=target_price_version_id and status='draft';
 select location_id into location from public.commercial_policy_versions where business_id=target_business_id and id=target_policy_version_id and status='draft';
 if book_id is null or location is null or not app.member_can_access_location(target_business_id,location) then raise exception 'pricing bundle unavailable' using errcode='P0002'; end if;
 if not exists(select 1 from public.price_rate_rules where business_id=target_business_id and price_book_version_id=target_price_version_id) then raise exception 'price book requires at least one rate' using errcode='23514'; end if;
 update public.price_book_versions set status='published',effective_from=effective_date,published_at=now(),published_by=auth.uid() where id=target_price_version_id;
 update public.price_books set status='active' where id=book_id;
 update public.commercial_policy_versions set status='published',published_at=now(),published_by=auth.uid() where id=target_policy_version_id;
end; $$;

create or replace function app.calculate_quote(
 target_business_id uuid,target_location_id uuid,target_pet_id uuid,target_service_id uuid,
 requested_start timestamptz,requested_end timestamptz,requested_quantity integer,requested_units integer,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;service_version uuid;book record;policy record;rate record;subtotal bigint;tax bigint;total bigint;deposit bigint;created_id uuid;currency text;
begin
 if not app.member_has_permission(target_business_id,'quotes.create') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'quote unavailable' using errcode='42501'; end if;
 select id into existing from public.quotes where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 if requested_quantity<1 or requested_units<1 or requested_end<=requested_start then raise exception 'invalid quote request' using errcode='22023';end if;
 select v.id into service_version from public.services s join public.service_versions v on v.business_id=s.business_id and v.service_id=s.id and v.status='published' where s.business_id=target_business_id and s.id=target_service_id and s.status='active';
 select pbv.id,pb.id as book_id,pb.currency_code into book from public.price_book_versions pbv join public.price_books pb on pb.business_id=pbv.business_id and pb.id=pbv.price_book_id where pbv.business_id=target_business_id and pbv.status='published' and pbv.effective_from<=requested_start::date order by pbv.effective_from desc limit 1;
 select * into policy from public.commercial_policy_versions where business_id=target_business_id and location_id=target_location_id and status='published' order by version_number desc limit 1;
 select * into rate from public.price_rate_rules where business_id=target_business_id and price_book_version_id=book.id and location_id=target_location_id and service_version_id=service_version and (starts_on is null or starts_on<=requested_start::date) and (ends_on is null or ends_on>=requested_start::date) and (day_of_week is null or day_of_week=extract(dow from requested_start)::integer) order by priority,amount_minor limit 1;
 if service_version is null or book.id is null or policy.id is null or rate.id is null then raise exception 'quote configuration incomplete' using errcode='P0002';end if;
 subtotal:=rate.amount_minor*requested_quantity*requested_units;tax:=(subtotal*policy.tax_rate_bps+5000)/10000;total:=subtotal+tax;
 deposit:=case policy.deposit_type when 'none' then 0 when 'fixed' then policy.deposit_value when 'percentage' then (total*policy.deposit_value+5000)/10000 when 'full' then total end;
 deposit:=greatest(deposit,policy.deposit_minimum_minor);if policy.deposit_maximum_minor is not null then deposit:=least(deposit,policy.deposit_maximum_minor);end if;deposit:=least(deposit,total);currency:=book.currency_code;
 insert into public.quotes(business_id,location_id,pet_id,service_version_id,price_book_version_id,policy_version_id,currency_code,starts_at,ends_at,quantity,charge_units,subtotal_minor,tax_minor,total_minor,deposit_due_minor,balance_due_minor,expires_at,idempotency_key,calculation_trace)
 values(target_business_id,target_location_id,target_pet_id,service_version,book.id,policy.id,currency,requested_start,requested_end,requested_quantity,requested_units,subtotal,tax,total,deposit,total-deposit,now()+interval '30 minutes',trim(request_key),jsonb_build_object('rate_rule_id',rate.id,'unit_amount_minor',rate.amount_minor,'rounding','half_up_minor_unit','tax_rate_bps',policy.tax_rate_bps,'deposit_type',policy.deposit_type,'deposit_value',policy.deposit_value)) returning id into created_id;
 insert into public.quote_lines(business_id,quote_id,line_type,label,quantity,unit_amount_minor,total_minor,source_rule_id,explanation,display_order) values
 (target_business_id,created_id,'base',rate.label,requested_quantity*requested_units,rate.amount_minor,subtotal,rate.id,concat(requested_quantity,' × ',requested_units,' × ',rate.amount_minor,' minor units'),10),
 (target_business_id,created_id,'tax','Tax',1,tax,tax,null,concat(policy.tax_rate_bps,' basis points using half-up rounding'),90);
 return created_id;
end; $$;

create or replace function app.accept_quote_agreement(target_business_id uuid,target_quote_id uuid,evidence_value jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare quote_record public.quotes%rowtype;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'quotes.create') then raise exception 'agreement acceptance unavailable' using errcode='42501';end if;
 select * into quote_record from public.quotes where business_id=target_business_id and id=target_quote_id and status='valid' and expires_at>now();
 if quote_record.id is null then raise exception 'valid quote unavailable' using errcode='P0002';end if;
 if jsonb_typeof(evidence_value)<>'object' or not evidence_value ? 'method' then raise exception 'acceptance evidence required' using errcode='22023';end if;
 select id into created_id from public.agreement_acceptances where business_id=target_business_id and quote_id=quote_record.id and policy_version_id=quote_record.policy_version_id and actor_identity_id=auth.uid();
 if created_id is not null then return created_id;end if;
 insert into public.agreement_acceptances(business_id,quote_id,policy_version_id,actor_identity_id,evidence)
 values(target_business_id,quote_record.id,quote_record.policy_version_id,auth.uid(),evidence_value)
 returning id into created_id;return created_id;
end; $$;

do $$declare n text;begin foreach n in array array['price_books','price_book_versions','price_rate_rules','commercial_policy_versions','quotes','quote_lines','agreement_acceptances'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);end loop;end$$;
create policy pricing_books_view on public.price_books for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
create policy pricing_versions_view on public.price_book_versions for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
create policy pricing_rates_view on public.price_rate_rules for select to authenticated using(app.member_has_permission(business_id,'pricing.view') and app.member_can_access_location(business_id,location_id));
create policy pricing_policy_view on public.commercial_policy_versions for select to authenticated using(app.member_has_permission(business_id,'pricing.view') and app.member_can_access_location(business_id,location_id));
create policy quotes_view on public.quotes for select to authenticated using(app.member_has_permission(business_id,'pricing.view') and app.member_can_access_location(business_id,location_id));
create policy quote_lines_view on public.quote_lines for select to authenticated using(app.member_has_permission(business_id,'pricing.view') and exists(select 1 from public.quotes q where q.business_id=quote_lines.business_id and q.id=quote_lines.quote_id and app.member_can_access_location(q.business_id,q.location_id)));
create policy agreements_view on public.agreement_acceptances for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
revoke all on public.price_books,public.price_book_versions,public.price_rate_rules,public.commercial_policy_versions,public.quotes,public.quote_lines,public.agreement_acceptances from anon,authenticated;
grant select on public.price_books,public.price_book_versions,public.price_rate_rules,public.commercial_policy_versions,public.quotes,public.quote_lines,public.agreement_acceptances to authenticated;
revoke all on function app.create_pricing_bundle(uuid,uuid,text,text,text,text,integer,integer,integer,bigint,bigint,text,text,text),app.add_price_rate(uuid,uuid,uuid,uuid,text,bigint,text,integer,date,date),app.publish_pricing_bundle(uuid,uuid,uuid,date),app.calculate_quote(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text),app.accept_quote_agreement(uuid,uuid,jsonb) from public;
grant execute on function app.create_pricing_bundle(uuid,uuid,text,text,text,text,integer,integer,integer,bigint,bigint,text,text,text),app.add_price_rate(uuid,uuid,uuid,uuid,text,bigint,text,integer,date,date),app.publish_pricing_bundle(uuid,uuid,uuid,date),app.calculate_quote(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text),app.accept_quote_agreement(uuid,uuid,jsonb) to authenticated;
