-- PetCare E06 pricing revisions, adjustments, discounts, and cancellation outcomes.
alter table public.quotes add column supersedes_quote_id uuid;
alter table public.quotes add column coupon_code text;
alter table public.quotes add constraint quotes_supersedes_fk foreign key(business_id,supersedes_quote_id) references public.quotes(business_id,id) on delete restrict;

create table public.price_adjustment_rules(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,price_book_version_id uuid not null,
 location_id uuid not null,service_version_id uuid,rule_type text not null check(rule_type in('seasonal','holiday','weekend','peak')),
 adjustment_type text not null check(adjustment_type in('fixed','percentage')),adjustment_value integer not null check(adjustment_value>=0),
 label text not null check(char_length(trim(label)) between 1 and 160),priority integer not null default 100,
 starts_on date,ends_on date,day_of_week smallint check(day_of_week between 0 and 6),created_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,price_book_version_id) references public.price_book_versions(business_id,id) on delete restrict,
 foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,service_version_id) references public.service_versions(business_id,id) on delete restrict,
 check(ends_on is null or starts_on is not null),check(ends_on is null or ends_on>=starts_on)
);
create index price_adjustment_lookup_idx on public.price_adjustment_rules(business_id,price_book_version_id,location_id,service_version_id,priority);

create table public.discount_rules(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,price_book_version_id uuid not null,
 code text not null,discount_type text not null check(discount_type in('fixed','percentage')),discount_value integer not null check(discount_value>=0),
 maximum_discount_minor bigint check(maximum_discount_minor is null or maximum_discount_minor>=0),minimum_subtotal_minor bigint not null default 0 check(minimum_subtotal_minor>=0),
 starts_at timestamptz,ends_at timestamptz,usage_limit integer check(usage_limit is null or usage_limit>0),label text not null,
 created_at timestamptz not null default now(),unique(business_id,id),unique(business_id,price_book_version_id,code),
 foreign key(business_id,price_book_version_id) references public.price_book_versions(business_id,id) on delete restrict,
 check(code=upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),check(ends_at is null or starts_at is null or ends_at>starts_at),
 check(discount_type<>'percentage' or discount_value<=10000)
);

create table public.coupon_redemptions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,discount_rule_id uuid not null,quote_id uuid not null,
 code text not null,discount_minor bigint not null check(discount_minor>=0),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,quote_id),foreign key(business_id,discount_rule_id) references public.discount_rules(business_id,id) on delete restrict,
 foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete restrict
);

create table public.cancellation_outcomes(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,quote_id uuid not null,policy_version_id uuid not null,
 outcome_type text not null check(outcome_type in('cancellation','no_show')),occurred_at timestamptz not null,notice_hours integer not null,
 original_total_minor bigint not null,original_deposit_minor bigint not null,fee_minor bigint not null,refund_minor bigint not null,
 override_applied boolean not null default false,override_reason text,calculation_trace jsonb not null check(jsonb_typeof(calculation_trace)='object'),
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete restrict,
 foreign key(business_id,policy_version_id) references public.commercial_policy_versions(business_id,id) on delete restrict,
 check(fee_minor>=0 and refund_minor>=0),check(not override_applied or char_length(trim(override_reason))>=8)
);

create trigger cancellation_outcomes_immutable before update or delete on public.cancellation_outcomes for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.prevent_published_commercial_change() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and old.status<>'draft' then raise exception 'published commercial configuration is immutable' using errcode='23514'; end if;
 if tg_op='UPDATE' and old.status<>'draft' and not(old.status='published' and new.status='superseded' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status')) then raise exception 'published commercial configuration is immutable' using errcode='23514'; end if;
 if tg_op='DELETE' then return old;end if;return new;
end; $$;

create or replace function app.create_pricing_revision(target_business_id uuid,target_price_version_id uuid,target_policy_version_id uuid)
returns table(price_book_version_id uuid,policy_version_id uuid) language plpgsql security definer set search_path='' as $$
declare source_price public.price_book_versions%rowtype;source_policy public.commercial_policy_versions%rowtype;
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 select * into source_price from public.price_book_versions where business_id=target_business_id and id=target_price_version_id and status='published';
 select * into source_policy from public.commercial_policy_versions where business_id=target_business_id and id=target_policy_version_id and status='published';
 if source_price.id is null or source_policy.id is null or not app.member_can_access_location(target_business_id,source_policy.location_id) then raise exception 'published pricing bundle unavailable' using errcode='P0002'; end if;
 insert into public.price_book_versions(business_id,price_book_id,version_number) values(target_business_id,source_price.price_book_id,source_price.version_number+1) returning id into price_book_version_id;
 insert into public.price_rate_rules(business_id,price_book_version_id,location_id,service_version_id,charge_unit,amount_minor,priority,starts_on,ends_on,day_of_week,label)
 select r.business_id,create_pricing_revision.price_book_version_id,r.location_id,r.service_version_id,r.charge_unit,r.amount_minor,r.priority,r.starts_on,r.ends_on,r.day_of_week,r.label from public.price_rate_rules r where r.business_id=target_business_id and r.price_book_version_id=source_price.id;
 insert into public.price_adjustment_rules(business_id,price_book_version_id,location_id,service_version_id,rule_type,adjustment_type,adjustment_value,label,priority,starts_on,ends_on,day_of_week)
 select a.business_id,create_pricing_revision.price_book_version_id,a.location_id,a.service_version_id,a.rule_type,a.adjustment_type,a.adjustment_value,a.label,a.priority,a.starts_on,a.ends_on,a.day_of_week from public.price_adjustment_rules a where a.business_id=target_business_id and a.price_book_version_id=source_price.id;
 insert into public.discount_rules(business_id,price_book_version_id,code,discount_type,discount_value,maximum_discount_minor,minimum_subtotal_minor,starts_at,ends_at,usage_limit,label)
 select d.business_id,create_pricing_revision.price_book_version_id,d.code,d.discount_type,d.discount_value,d.maximum_discount_minor,d.minimum_subtotal_minor,d.starts_at,d.ends_at,d.usage_limit,d.label from public.discount_rules d where d.business_id=target_business_id and d.price_book_version_id=source_price.id;
 insert into public.commercial_policy_versions(business_id,location_id,name,version_number,deposit_type,deposit_value,deposit_minimum_minor,deposit_maximum_minor,tax_rate_bps,balance_due_timing,cancellation_notice_hours,late_cancellation_fee_minor,no_show_fee_minor,agreement_title,agreement_body,customer_summary)
 values(target_business_id,source_policy.location_id,source_policy.name,source_policy.version_number+1,source_policy.deposit_type,source_policy.deposit_value,source_policy.deposit_minimum_minor,source_policy.deposit_maximum_minor,source_policy.tax_rate_bps,source_policy.balance_due_timing,source_policy.cancellation_notice_hours,source_policy.late_cancellation_fee_minor,source_policy.no_show_fee_minor,source_policy.agreement_title,source_policy.agreement_body,source_policy.customer_summary) returning id into policy_version_id;
 return next;
end; $$;

create or replace function app.add_price_adjustment(target_business_id uuid,target_price_version_id uuid,target_location_id uuid,target_service_version_id uuid,rule_kind text,adjustment_kind text,adjustment_amount integer,label_value text,priority_value integer,start_date date default null,end_date date default null,dow smallint default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.price_book_versions where business_id=target_business_id and id=target_price_version_id and status='draft') then raise exception 'draft price book unavailable' using errcode='P0002'; end if;
 insert into public.price_adjustment_rules(business_id,price_book_version_id,location_id,service_version_id,rule_type,adjustment_type,adjustment_value,label,priority,starts_on,ends_on,day_of_week)
 values(target_business_id,target_price_version_id,target_location_id,target_service_version_id,rule_kind,adjustment_kind,adjustment_amount,trim(label_value),priority_value,start_date,end_date,dow) returning id into created_id;return created_id;
end; $$;

create or replace function app.add_discount_code(target_business_id uuid,target_price_version_id uuid,code_value text,discount_kind text,discount_amount integer,label_value text,minimum_minor bigint default 0,maximum_minor bigint default null,usage_limit_value integer default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.price_book_versions where business_id=target_business_id and id=target_price_version_id and status='draft') then raise exception 'draft price book unavailable' using errcode='P0002'; end if;
 insert into public.discount_rules(business_id,price_book_version_id,code,discount_type,discount_value,maximum_discount_minor,minimum_subtotal_minor,usage_limit,label)
 values(target_business_id,target_price_version_id,upper(trim(code_value)),discount_kind,discount_amount,maximum_minor,minimum_minor,usage_limit_value,trim(label_value)) returning id into created_id;return created_id;
end; $$;

create or replace function app.publish_pricing_bundle(target_business_id uuid,target_price_version_id uuid,target_policy_version_id uuid,effective_date date)
returns void language plpgsql security definer set search_path='' as $$ declare book_id uuid;location uuid;
begin
 if not app.member_has_permission(target_business_id,'pricing.manage') then raise exception 'pricing management unavailable' using errcode='42501'; end if;
 select price_book_id into book_id from public.price_book_versions where business_id=target_business_id and id=target_price_version_id and status='draft';
 select location_id into location from public.commercial_policy_versions where business_id=target_business_id and id=target_policy_version_id and status='draft';
 if book_id is null or location is null or not app.member_can_access_location(target_business_id,location) then raise exception 'pricing bundle unavailable' using errcode='P0002'; end if;
 if not exists(select 1 from public.price_rate_rules where business_id=target_business_id and price_book_version_id=target_price_version_id) then raise exception 'price book requires at least one rate' using errcode='23514'; end if;
 update public.price_book_versions set status='superseded' where business_id=target_business_id and price_book_id=book_id and status='published';
 update public.commercial_policy_versions set status='superseded' where business_id=target_business_id and location_id=location and status='published';
 update public.price_book_versions set status='published',effective_from=effective_date,published_at=now(),published_by=auth.uid() where id=target_price_version_id;
 update public.price_books set status='active' where id=book_id;
 update public.commercial_policy_versions set status='published',published_at=now(),published_by=auth.uid() where id=target_policy_version_id;
end; $$;

create or replace function app.calculate_quote_with_adjustments(target_business_id uuid,target_location_id uuid,target_pet_id uuid,target_service_id uuid,requested_start timestamptz,requested_end timestamptz,requested_quantity integer,requested_units integer,request_key text,coupon_value text default null,superseded_quote uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;service_version uuid;book record;policy record;rate record;adjustment record;discount record;subtotal bigint;fee bigint:=0;discount_total bigint:=0;taxable bigint;tax bigint;total bigint;deposit bigint;created_id uuid;redemptions integer;
begin
 if not app.member_has_permission(target_business_id,'quotes.create') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'quote unavailable' using errcode='42501'; end if;
 select id into existing from public.quotes where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 if requested_quantity<1 or requested_units<1 or requested_end<=requested_start then raise exception 'invalid quote request' using errcode='22023';end if;
 if superseded_quote is not null and not exists(select 1 from public.quotes where business_id=target_business_id and id=superseded_quote) then raise exception 'superseded quote unavailable' using errcode='P0002';end if;
 select v.id into service_version from public.services s join public.service_versions v on v.business_id=s.business_id and v.service_id=s.id and v.status='published' where s.business_id=target_business_id and s.id=target_service_id and s.status='active';
 select pbv.id,pb.currency_code into book from public.price_book_versions pbv join public.price_books pb on pb.business_id=pbv.business_id and pb.id=pbv.price_book_id where pbv.business_id=target_business_id and pbv.status='published' and pbv.effective_from<=requested_start::date order by pbv.effective_from desc limit 1;
 select * into policy from public.commercial_policy_versions where business_id=target_business_id and location_id=target_location_id and status='published' order by version_number desc limit 1;
 select * into rate from public.price_rate_rules where business_id=target_business_id and price_book_version_id=book.id and location_id=target_location_id and service_version_id=service_version and (starts_on is null or starts_on<=requested_start::date) and (ends_on is null or ends_on>=requested_start::date) and (day_of_week is null or day_of_week=extract(dow from requested_start)::integer) order by priority,amount_minor limit 1;
 if service_version is null or book.id is null or policy.id is null or rate.id is null then raise exception 'quote configuration incomplete' using errcode='P0002';end if;
 subtotal:=rate.amount_minor*requested_quantity*requested_units;
 select * into adjustment from public.price_adjustment_rules where business_id=target_business_id and price_book_version_id=book.id and location_id=target_location_id and (service_version_id is null or service_version_id=service_version) and (starts_on is null or starts_on<=requested_start::date) and (ends_on is null or ends_on>=requested_start::date) and (day_of_week is null or day_of_week=extract(dow from requested_start)::integer) order by priority,id limit 1;
 if adjustment.id is not null then fee:=case adjustment.adjustment_type when 'fixed' then adjustment.adjustment_value::bigint*requested_quantity*requested_units else (subtotal*adjustment.adjustment_value+5000)/10000 end;end if;
 if nullif(trim(coupon_value),'') is not null then
  select * into discount from public.discount_rules where business_id=target_business_id and price_book_version_id=book.id and code=upper(trim(coupon_value)) and minimum_subtotal_minor<=subtotal+fee and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) limit 1;
  if discount.id is null then raise exception 'coupon unavailable' using errcode='P0002';end if;
  select count(*) into redemptions from public.coupon_redemptions where business_id=target_business_id and discount_rule_id=discount.id;
  if discount.usage_limit is not null and redemptions>=discount.usage_limit then raise exception 'coupon usage limit reached' using errcode='23514';end if;
  discount_total:=case discount.discount_type when 'fixed' then discount.discount_value else ((subtotal+fee)*discount.discount_value+5000)/10000 end;
  if discount.maximum_discount_minor is not null then discount_total:=least(discount_total,discount.maximum_discount_minor);end if;discount_total:=least(discount_total,subtotal+fee);
 end if;
 taxable:=subtotal+fee-discount_total;tax:=(taxable*policy.tax_rate_bps+5000)/10000;total:=taxable+tax;
 deposit:=case policy.deposit_type when 'none' then 0 when 'fixed' then policy.deposit_value when 'percentage' then (total*policy.deposit_value+5000)/10000 when 'full' then total end;
 deposit:=greatest(deposit,policy.deposit_minimum_minor);if policy.deposit_maximum_minor is not null then deposit:=least(deposit,policy.deposit_maximum_minor);end if;deposit:=least(deposit,total);
 insert into public.quotes(business_id,location_id,pet_id,service_version_id,price_book_version_id,policy_version_id,currency_code,starts_at,ends_at,quantity,charge_units,subtotal_minor,discount_minor,fee_minor,tax_minor,total_minor,deposit_due_minor,balance_due_minor,expires_at,idempotency_key,calculation_trace,coupon_code,supersedes_quote_id)
 values(target_business_id,target_location_id,target_pet_id,service_version,book.id,policy.id,book.currency_code,requested_start,requested_end,requested_quantity,requested_units,subtotal,discount_total,fee,tax,total,deposit,total-deposit,now()+interval '30 minutes',trim(request_key),jsonb_build_object('rate_rule_id',rate.id,'adjustment_rule_id',adjustment.id,'discount_rule_id',discount.id,'rounding','half_up_minor_unit','taxable_minor',taxable),nullif(upper(trim(coupon_value)),''),superseded_quote) returning id into created_id;
 insert into public.quote_lines(business_id,quote_id,line_type,label,quantity,unit_amount_minor,total_minor,source_rule_id,explanation,display_order) values(target_business_id,created_id,'base',rate.label,requested_quantity*requested_units,rate.amount_minor,subtotal,rate.id,'Published base rate snapshot',10);
 if fee>0 then insert into public.quote_lines(business_id,quote_id,line_type,label,quantity,unit_amount_minor,total_minor,source_rule_id,explanation,display_order) values(target_business_id,created_id,'adjustment',adjustment.label,1,fee,fee,adjustment.id,concat(adjustment.rule_type,' ',adjustment.adjustment_type,' adjustment'),30);end if;
 if discount_total>0 then insert into public.quote_lines(business_id,quote_id,line_type,label,quantity,unit_amount_minor,total_minor,source_rule_id,explanation,display_order) values(target_business_id,created_id,'discount',discount.label,1,-discount_total,-discount_total,discount.id,concat('Coupon ',discount.code),60);insert into public.coupon_redemptions(business_id,discount_rule_id,quote_id,code,discount_minor) values(target_business_id,discount.id,created_id,discount.code,discount_total);end if;
 insert into public.quote_lines(business_id,quote_id,line_type,label,quantity,unit_amount_minor,total_minor,explanation,display_order) values(target_business_id,created_id,'tax','Tax',1,tax,tax,concat(policy.tax_rate_bps,' basis points using half-up rounding'),90);
 return created_id;
end; $$;

create or replace function app.calculate_cancellation_outcome(target_business_id uuid,target_quote_id uuid,outcome_kind text,event_time timestamptz,override_fee_minor bigint default null,override_reason_value text default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare q public.quotes%rowtype;p public.commercial_policy_versions%rowtype;hours_notice integer;fee bigint;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'pricing.view') then raise exception 'cancellation outcome unavailable' using errcode='42501';end if;
 select * into q from public.quotes where business_id=target_business_id and id=target_quote_id;if q.id is null or not app.member_can_access_location(target_business_id,q.location_id) then raise exception 'quote unavailable' using errcode='P0002';end if;
 select * into p from public.commercial_policy_versions where business_id=target_business_id and id=q.policy_version_id;
 hours_notice:=greatest(floor(extract(epoch from(q.starts_at-event_time))/3600),0)::integer;
 fee:=case when outcome_kind='no_show' then p.no_show_fee_minor when outcome_kind='cancellation' and hours_notice<p.cancellation_notice_hours then p.late_cancellation_fee_minor else 0 end;fee:=least(fee,q.total_minor);
 if override_fee_minor is not null then if not app.member_has_permission(target_business_id,'pricing.manage') or char_length(trim(coalesce(override_reason_value,'')))<8 then raise exception 'manager override requires permission and reason' using errcode='42501';end if;fee:=least(greatest(override_fee_minor,0),q.total_minor);end if;
 insert into public.cancellation_outcomes(business_id,quote_id,policy_version_id,outcome_type,occurred_at,notice_hours,original_total_minor,original_deposit_minor,fee_minor,refund_minor,override_applied,override_reason,calculation_trace)
 values(target_business_id,q.id,p.id,outcome_kind,event_time,hours_notice,q.total_minor,q.deposit_due_minor,fee,greatest(q.deposit_due_minor-fee,0),override_fee_minor is not null,nullif(trim(override_reason_value),''),jsonb_build_object('notice_threshold_hours',p.cancellation_notice_hours,'published_late_fee_minor',p.late_cancellation_fee_minor,'published_no_show_fee_minor',p.no_show_fee_minor)) returning id into created_id;return created_id;
end; $$;

alter table public.price_adjustment_rules enable row level security;alter table public.price_adjustment_rules force row level security;
alter table public.discount_rules enable row level security;alter table public.discount_rules force row level security;
alter table public.coupon_redemptions enable row level security;alter table public.coupon_redemptions force row level security;
alter table public.cancellation_outcomes enable row level security;alter table public.cancellation_outcomes force row level security;
create policy adjustment_select on public.price_adjustment_rules for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
create policy discount_select on public.discount_rules for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
create policy redemption_select on public.coupon_redemptions for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
create policy cancellation_select on public.cancellation_outcomes for select to authenticated using(app.member_has_permission(business_id,'pricing.view'));
revoke all on public.price_adjustment_rules,public.discount_rules,public.coupon_redemptions,public.cancellation_outcomes from anon,authenticated;
grant select on public.price_adjustment_rules,public.discount_rules,public.coupon_redemptions,public.cancellation_outcomes to authenticated;
revoke all on function app.create_pricing_revision(uuid,uuid,uuid),app.add_price_adjustment(uuid,uuid,uuid,uuid,text,text,integer,text,integer,date,date,smallint),app.add_discount_code(uuid,uuid,text,text,integer,text,bigint,bigint,integer),app.calculate_quote_with_adjustments(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text,uuid),app.calculate_cancellation_outcome(uuid,uuid,text,timestamptz,bigint,text) from public;
grant execute on function app.create_pricing_revision(uuid,uuid,uuid),app.add_price_adjustment(uuid,uuid,uuid,uuid,text,text,integer,text,integer,date,date,smallint),app.add_discount_code(uuid,uuid,text,text,integer,text,bigint,bigint,integer),app.calculate_quote_with_adjustments(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text,uuid),app.calculate_cancellation_outcome(uuid,uuid,text,timestamptz,bigint,text) to authenticated;
