-- PetCare E07 booking, waitlist, and authoritative calendar foundation.
create table public.business_booking_counters(
 business_id uuid primary key references public.businesses(id) on delete restrict,next_value bigint not null default 1 check(next_value>0)
);
create table public.bookings(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,customer_id uuid not null,
 booking_number text not null,status text not null check(status in('draft','action_required','pending_approval','pending_deposit','confirmed','cancelled','no_show','completed','expired')),
 source_channel text not null check(source_channel in('staff','customer_portal','public_website','api','waitlist')),
 current_revision_number integer not null default 1 check(current_revision_number>0),idempotency_key text not null,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,booking_number),unique(business_id,idempotency_key),
 foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict
);
create index bookings_calendar_idx on public.bookings(business_id,location_id,status,created_at);
create table public.booking_revisions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_id uuid not null,revision_number integer not null,
 status text not null,quote_id uuid not null,policy_version_id uuid not null,capacity_hold_id uuid,change_reason text,
 customer_authority_snapshot jsonb not null check(jsonb_typeof(customer_authority_snapshot)='object'),validation_snapshot jsonb not null check(jsonb_typeof(validation_snapshot)='object'),
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,booking_id,revision_number),foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
 foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete restrict,
 foreign key(business_id,policy_version_id) references public.commercial_policy_versions(business_id,id) on delete restrict,
 foreign key(business_id,capacity_hold_id) references public.capacity_holds(business_id,id) on delete restrict
);
create table public.booking_items(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_id uuid not null,booking_revision_id uuid not null,
 pet_id uuid not null,service_version_id uuid not null,starts_at timestamptz not null,ends_at timestamptz not null,quantity integer not null check(quantity>0),
 capacity_commitment_id uuid,status text not null check(status in('requested','held','confirmed','cancelled','completed')),
 created_at timestamptz not null default now(),unique(business_id,id),
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
 foreign key(business_id,booking_revision_id) references public.booking_revisions(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 foreign key(business_id,service_version_id) references public.service_versions(business_id,id) on delete restrict,
 foreign key(business_id,capacity_commitment_id) references public.capacity_commitments(business_id,id) on delete restrict,
 check(ends_at>starts_at)
);
create index booking_items_calendar_idx on public.booking_items(business_id,starts_at,ends_at,status);
alter table public.capacity_commitments add constraint capacity_commitment_booking_item_fk foreign key(business_id,booking_item_id) references public.booking_items(business_id,id) on delete restrict;

create table public.booking_validation_results(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_revision_id uuid not null,
 check_type text not null check(check_type in('authority','service','eligibility','capacity','pricing','policy','payment')),
 outcome text not null check(outcome in('passed','failed','review','pending','overridden')),blocking boolean not null,
 customer_message text not null,details jsonb not null check(jsonb_typeof(details)='object'),created_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,booking_revision_id) references public.booking_revisions(business_id,id) on delete restrict
);
create table public.booking_timeline_events(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_id uuid not null,event_type text not null,
 customer_visible boolean not null default false,summary text not null,details jsonb not null check(jsonb_typeof(details)='object'),
 actor_id uuid references auth.users(id) on delete restrict,occurred_at timestamptz not null default now(),unique(business_id,id),
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict
);
create index booking_timeline_idx on public.booking_timeline_events(business_id,booking_id,occurred_at);

create table public.waitlist_entries(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,location_id uuid not null,customer_id uuid not null,pet_id uuid not null,service_id uuid not null,
 preferred_start timestamptz not null,preferred_end timestamptz not null,quantity integer not null check(quantity>0),flexibility_days integer not null default 0 check(flexibility_days between 0 and 30),
 status text not null default 'active' check(status in('active','offered','converted','declined','withdrawn','expired','removed')),
 priority_created_at timestamptz not null default now(),expires_at timestamptz,eligibility_snapshot jsonb not null check(jsonb_typeof(eligibility_snapshot)='object'),
 idempotency_key text not null,created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict,
 foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,
 foreign key(business_id,pet_id) references public.pets(business_id,id) on delete restrict,
 foreign key(business_id,service_id) references public.services(business_id,id) on delete restrict,check(preferred_end>preferred_start)
);
create index waitlist_active_idx on public.waitlist_entries(business_id,location_id,service_id,priority_created_at) where status='active';

create trigger bookings_updated before update on public.bookings for each row execute function app.set_updated_at();
create trigger waitlist_entries_updated before update on public.waitlist_entries for each row execute function app.set_updated_at();
create trigger bookings_tenant before update on public.bookings for each row execute function app.prevent_business_id_change();
create trigger waitlist_tenant before update on public.waitlist_entries for each row execute function app.prevent_business_id_change();
create trigger booking_revisions_immutable before update or delete on public.booking_revisions for each row execute function app.prevent_commercial_snapshot_change();
create trigger booking_validations_immutable before update or delete on public.booking_validation_results for each row execute function app.prevent_commercial_snapshot_change();
create trigger booking_timeline_immutable before update or delete on public.booking_timeline_events for each row execute function app.prevent_commercial_snapshot_change();
create trigger bookings_audit after insert or update or delete on public.bookings for each row execute function app.audit_configuration_change('booking.changed','booking');
create trigger waitlist_audit after insert or update or delete on public.waitlist_entries for each row execute function app.audit_configuration_change('waitlist.entry.changed','waitlist_entry');

create or replace function app.next_booking_number(target_business_id uuid)
returns text language plpgsql security definer set search_path='' as $$ declare allocated bigint;
begin
 insert into public.business_booking_counters(business_id,next_value) values(target_business_id,2)
 on conflict(business_id) do update set next_value=public.business_booking_counters.next_value+1 returning next_value-1 into allocated;
 if allocated is null then allocated:=1;end if;return 'PC-'||lpad(allocated::text,6,'0');
end; $$;

create or replace function app.create_booking_request(
 target_business_id uuid,target_location_id uuid,target_customer_id uuid,target_pet_id uuid,target_service_id uuid,
 requested_start timestamptz,requested_end timestamptz,requested_quantity integer,requested_units integer,coupon_value text,source_value text,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;explanation jsonb;pool_id uuid;service_version uuid;confirmation text;hold_id uuid;quote_id uuid;q public.quotes%rowtype;
 booking_id uuid;revision_id uuid;item_id uuid;commitment_id uuid;booking_status text;number_value text;authority jsonb;
begin
 if not app.member_has_permission(target_business_id,'bookings.create') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'booking creation unavailable' using errcode='42501';end if;
 select id into existing from public.bookings where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 if source_value not in('staff','customer_portal','public_website','api','waitlist') or requested_quantity<1 or requested_units<1 or requested_end<=requested_start then raise exception 'invalid booking request' using errcode='22023';end if;
 select jsonb_build_object('customer_id',c.id,'household_id',p.household_id,'relationship',hm.role) into authority
 from public.customers c join public.household_members hm on hm.business_id=c.business_id and hm.customer_id=c.id
 join public.pets p on p.business_id=hm.business_id and p.household_id=hm.household_id and p.id=target_pet_id and p.status='active'
 where c.business_id=target_business_id and c.id=target_customer_id and c.status='active' limit 1;
 if authority is null then raise exception 'customer booking authority unavailable' using errcode='42501';end if;
 explanation:=app.explain_service_availability(target_business_id,target_location_id,target_service_id,target_pet_id,requested_start,requested_end,requested_quantity);
 if not coalesce((explanation->>'available')::boolean,false) then raise exception 'booking requirements or capacity unavailable' using errcode='P0001',detail=explanation::text;end if;
 pool_id:=(explanation->>'capacity_pool_id')::uuid;service_version:=(explanation->>'service_version_id')::uuid;
 select confirmation_mode into confirmation from public.service_versions where business_id=target_business_id and id=service_version;
 hold_id:=app.create_capacity_hold(target_business_id,pool_id,requested_start,requested_end,requested_quantity,15,'booking-hold-'||request_key);
 quote_id:=app.calculate_quote_with_adjustments(target_business_id,target_location_id,target_pet_id,target_service_id,requested_start,requested_end,requested_quantity,requested_units,'booking-quote-'||request_key,coupon_value,null);
 select * into q from public.quotes where business_id=target_business_id and id=quote_id;
 booking_status:=case when (explanation->>'requires_review')::boolean then 'action_required' when confirmation in('staff_approval','request_only') then 'pending_approval' when q.deposit_due_minor>0 then 'pending_deposit' else 'confirmed' end;
 number_value:=app.next_booking_number(target_business_id);
 insert into public.bookings(business_id,location_id,customer_id,booking_number,status,source_channel,idempotency_key)
 values(target_business_id,target_location_id,target_customer_id,number_value,booking_status,source_value,trim(request_key)) returning id into booking_id;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,capacity_hold_id,customer_authority_snapshot,validation_snapshot)
 values(target_business_id,booking_id,1,booking_status,quote_id,q.policy_version_id,hold_id,authority,explanation) returning id into revision_id;
 insert into public.booking_items(business_id,booking_id,booking_revision_id,pet_id,service_version_id,starts_at,ends_at,quantity,status)
 values(target_business_id,booking_id,revision_id,target_pet_id,service_version,requested_start,requested_end,requested_quantity,case when booking_status='confirmed' then 'confirmed' else 'held' end) returning id into item_id;
 insert into public.booking_validation_results(business_id,booking_revision_id,check_type,outcome,blocking,customer_message,details) values
 (target_business_id,revision_id,'authority','passed',false,'Booking authority verified.',authority),
 (target_business_id,revision_id,'eligibility',case when (explanation->>'requires_review')::boolean then 'review' else 'passed' end,(explanation->>'requires_review')::boolean,case when (explanation->>'requires_review')::boolean then 'One or more requirements need staff review.' else 'Pet requirements passed.' end,explanation),
 (target_business_id,revision_id,'capacity','passed',false,'Capacity is held for this request.',jsonb_build_object('hold_id',hold_id,'expires_at',(select expires_at from public.capacity_holds where id=hold_id))),
 (target_business_id,revision_id,'pricing','passed',false,'Pricing is complete.',jsonb_build_object('quote_id',quote_id,'total_minor',q.total_minor,'deposit_due_minor',q.deposit_due_minor)),
 (target_business_id,revision_id,'payment',case when q.deposit_due_minor>0 then 'pending' else 'passed' end,q.deposit_due_minor>0,case when q.deposit_due_minor>0 then 'A deposit is required before confirmation.' else 'No deposit is required.' end,jsonb_build_object('deposit_due_minor',q.deposit_due_minor));
 if booking_status='confirmed' then commitment_id:=app.convert_capacity_hold(target_business_id,hold_id,item_id);update public.booking_items set capacity_commitment_id=commitment_id where business_id=target_business_id and id=item_id;end if;
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values
 (target_business_id,booking_id,'booking.requested',true,'Booking request created.',jsonb_build_object('status',booking_status,'booking_number',number_value),auth.uid());
 if booking_status='confirmed' then insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,booking_id,'booking.confirmed',true,'Booking confirmed.',jsonb_build_object('capacity_commitment_id',commitment_id),auth.uid());end if;
 return booking_id;
end; $$;

create or replace function app.create_waitlist_entry(
 target_business_id uuid,target_location_id uuid,target_customer_id uuid,target_pet_id uuid,target_service_id uuid,
 requested_start timestamptz,requested_end timestamptz,requested_quantity integer,flex_days integer,request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;version_id uuid;eligibility record;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'bookings.create') or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'waitlist unavailable' using errcode='42501';end if;
 select id into existing from public.waitlist_entries where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 if requested_quantity<1 or flex_days not between 0 and 30 or requested_end<=requested_start or requested_start<=now() then raise exception 'invalid waitlist request' using errcode='22023';end if;
 if not exists(select 1 from public.household_members hm join public.pets p on p.business_id=hm.business_id and p.household_id=hm.household_id where hm.business_id=target_business_id and hm.customer_id=target_customer_id and p.id=target_pet_id and p.status='active') then raise exception 'customer booking authority unavailable' using errcode='42501';end if;
 select v.id into version_id from public.services s join public.service_versions v on v.business_id=s.business_id and v.service_id=s.id and v.status='published' where s.business_id=target_business_id and s.id=target_service_id and s.status='active';
 select * into eligibility from app.evaluate_pet_service_eligibility(target_business_id,target_pet_id,version_id,requested_start::date);
 if version_id is null or not eligibility.eligible then raise exception 'waitlist eligibility unavailable' using errcode='P0001';end if;
 insert into public.waitlist_entries(business_id,location_id,customer_id,pet_id,service_id,preferred_start,preferred_end,quantity,flexibility_days,expires_at,eligibility_snapshot,idempotency_key)
 values(target_business_id,target_location_id,target_customer_id,target_pet_id,target_service_id,requested_start,requested_end,requested_quantity,flex_days,requested_start, jsonb_build_object('eligible',eligibility.eligible,'requires_review',eligibility.requires_review,'reasons',eligibility.reasons,'service_version_id',version_id),trim(request_key)) returning id into created_id;return created_id;
end; $$;

create or replace function app.withdraw_waitlist_entry(target_business_id uuid,target_entry_id uuid,reason_value text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not app.member_has_permission(target_business_id,'bookings.create') then raise exception 'waitlist unavailable' using errcode='42501';end if;
 update public.waitlist_entries set status='withdrawn' where business_id=target_business_id and id=target_entry_id and status='active';
 if not found then raise exception 'active waitlist entry unavailable' using errcode='P0002';end if;
 perform app.write_audit_event(target_business_id,auth.uid(),'waitlist.entry.withdrawn','waitlist_entry',target_entry_id,jsonb_build_object('reason',trim(reason_value)));
end; $$;

create or replace function app.cancel_booking(target_business_id uuid,target_booking_id uuid,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;r public.booking_revisions%rowtype;outcome_id uuid;new_revision uuid;
begin
 if not app.member_has_permission(target_business_id,'bookings.cancel') then raise exception 'booking cancellation unavailable' using errcode='42501';end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id for update;
 if b.status='cancelled' then select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and validation_snapshot->>'request_key'=request_key order by revision_number desc limit 1;if r.id is not null then return r.id;end if;end if;
 if b.id is null or b.status not in('confirmed','pending_deposit','pending_approval','action_required') or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'cancellable booking unavailable' using errcode='P0002';end if;
 select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 outcome_id:=app.calculate_cancellation_outcome(target_business_id,r.quote_id,'cancellation',now(),null,null);
 update public.capacity_commitments set status='released' where business_id=target_business_id and booking_item_id in(select id from public.booking_items where business_id=target_business_id and booking_id=b.id) and status='active';
 update public.capacity_holds set status=case when expires_at<=now() then 'expired' else 'released' end,release_reason='Booking cancelled' where business_id=target_business_id and id=r.capacity_hold_id and status='active';
 update public.bookings set status='cancelled',current_revision_number=current_revision_number+1 where id=b.id;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,capacity_hold_id,change_reason,customer_authority_snapshot,validation_snapshot)
 values(target_business_id,b.id,b.current_revision_number+1,'cancelled',r.quote_id,r.policy_version_id,r.capacity_hold_id,trim(reason_value),r.customer_authority_snapshot,jsonb_build_object('cancellation_outcome_id',outcome_id,'request_key',request_key)) returning id into new_revision;
 update public.booking_items set status='cancelled' where business_id=target_business_id and booking_id=b.id;
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'booking.cancelled',true,'Booking cancelled.',jsonb_build_object('reason',trim(reason_value),'cancellation_outcome_id',outcome_id),auth.uid());return new_revision;
end; $$;

do $$declare n text;begin foreach n in array array['business_booking_counters','bookings','booking_revisions','booking_items','booking_validation_results','booking_timeline_events','waitlist_entries'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);end loop;end$$;
create policy bookings_view on public.bookings for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and app.member_can_access_location(business_id,location_id));
create policy booking_revisions_view on public.booking_revisions for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_revisions.business_id and b.id=booking_revisions.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy booking_items_view on public.booking_items for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_items.business_id and b.id=booking_items.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy booking_validations_view on public.booking_validation_results for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.booking_revisions r join public.bookings b on b.business_id=r.business_id and b.id=r.booking_id where r.business_id=booking_validation_results.business_id and r.id=booking_validation_results.booking_revision_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy booking_timeline_view on public.booking_timeline_events for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_timeline_events.business_id and b.id=booking_timeline_events.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy waitlist_view on public.waitlist_entries for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and app.member_can_access_location(business_id,location_id));
revoke all on public.business_booking_counters,public.bookings,public.booking_revisions,public.booking_items,public.booking_validation_results,public.booking_timeline_events,public.waitlist_entries from anon,authenticated;
grant select on public.bookings,public.booking_revisions,public.booking_items,public.booking_validation_results,public.booking_timeline_events,public.waitlist_entries to authenticated;
revoke all on function app.next_booking_number(uuid),app.create_booking_request(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text,text),app.create_waitlist_entry(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text),app.withdraw_waitlist_entry(uuid,uuid,text),app.cancel_booking(uuid,uuid,text,text) from public;
grant execute on function app.create_booking_request(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text,text),app.create_waitlist_entry(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text),app.withdraw_waitlist_entry(uuid,uuid,text),app.cancel_booking(uuid,uuid,text,text) to authenticated;
