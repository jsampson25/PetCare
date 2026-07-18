-- PetCare E07 approval, rescheduling, payment handoff, and waitlist offer workflows.
create table public.booking_actions(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_id uuid not null,action_type text not null check(action_type in('review','deposit_confirmation')),
 decision text not null check(decision in('approved','rejected','changes_requested','confirmed')),reason text not null,
 external_reference text,idempotency_key text not null,actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict
);
create table public.booking_changes(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,booking_id uuid not null,from_revision_id uuid not null,to_revision_id uuid not null,
 change_type text not null check(change_type in('reschedule','approval','deposit_confirmation')),reason text not null,idempotency_key text not null,
 financial_impact jsonb not null check(jsonb_typeof(financial_impact)='object'),actor_id uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
 foreign key(business_id,from_revision_id) references public.booking_revisions(business_id,id) on delete restrict,
 foreign key(business_id,to_revision_id) references public.booking_revisions(business_id,id) on delete restrict
);
create table public.waitlist_offers(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,waitlist_entry_id uuid not null,capacity_hold_id uuid not null,
 offered_start timestamptz not null,offered_end timestamptz not null,deadline_at timestamptz not null,
 status text not null default 'offered' check(status in('offered','accepted','declined','expired','withdrawn')),
 match_explanation jsonb not null check(jsonb_typeof(match_explanation)='object'),booking_id uuid,idempotency_key text not null,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,idempotency_key),foreign key(business_id,waitlist_entry_id) references public.waitlist_entries(business_id,id) on delete restrict,
 foreign key(business_id,capacity_hold_id) references public.capacity_holds(business_id,id) on delete restrict,
 foreign key(business_id,booking_id) references public.bookings(business_id,id) on delete restrict,check(offered_end>offered_start),check(deadline_at>created_at)
);
create index waitlist_offers_deadline_idx on public.waitlist_offers(business_id,status,deadline_at) where status='offered';
create trigger waitlist_offers_updated before update on public.waitlist_offers for each row execute function app.set_updated_at();
create trigger booking_actions_immutable before update or delete on public.booking_actions for each row execute function app.prevent_commercial_snapshot_change();
create trigger booking_changes_immutable before update or delete on public.booking_changes for each row execute function app.prevent_commercial_snapshot_change();
create trigger waitlist_offers_tenant before update on public.waitlist_offers for each row execute function app.prevent_business_id_change();
create trigger waitlist_offers_audit after insert or update or delete on public.waitlist_offers for each row execute function app.audit_configuration_change('waitlist.offer.changed','waitlist_offer');

create or replace function app.resolve_booking_review(target_business_id uuid,target_booking_id uuid,decision_value text,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;b public.bookings%rowtype;prior public.booking_revisions%rowtype;q public.quotes%rowtype;item public.booking_items%rowtype;new_status text;new_revision uuid;new_item uuid;commitment uuid;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') or char_length(trim(reason_value))<8 then raise exception 'booking review unavailable' using errcode='42501';end if;
 select id into existing from public.booking_actions where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id for update;
 if b.id is null or b.status not in('action_required','pending_approval') or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'reviewable booking unavailable' using errcode='P0002';end if;
 if decision_value not in('approved','rejected','changes_requested') then raise exception 'invalid review decision' using errcode='22023';end if;
 select * into prior from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 select * into q from public.quotes where business_id=target_business_id and id=prior.quote_id;
 select * into item from public.booking_items where business_id=target_business_id and booking_id=b.id and status in('held','confirmed') order by created_at desc limit 1;
 if decision_value='approved' then
  if not exists(select 1 from public.capacity_holds where business_id=target_business_id and id=prior.capacity_hold_id and status='active' and expires_at>now()) then raise exception 'capacity hold expired' using errcode='P0001';end if;
  new_status:=case when q.deposit_due_minor>0 then 'pending_deposit' else 'confirmed' end;
 elsif decision_value='rejected' then new_status:='cancelled';else new_status:='action_required';end if;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,capacity_hold_id,change_reason,customer_authority_snapshot,validation_snapshot)
 values(target_business_id,b.id,b.current_revision_number+1,new_status,prior.quote_id,prior.policy_version_id,prior.capacity_hold_id,trim(reason_value),prior.customer_authority_snapshot,jsonb_build_object('review_decision',decision_value,'prior_validation',prior.validation_snapshot)) returning id into new_revision;
 insert into public.booking_validation_results(business_id,booking_revision_id,check_type,outcome,blocking,customer_message,details)
 select business_id,new_revision,check_type,case when check_type='eligibility' and outcome='review' and decision_value='approved' then 'overridden' else outcome end,case when check_type='eligibility' and outcome='review' and decision_value='approved' then false else blocking end,customer_message,details||jsonb_build_object('review_decision',decision_value,'review_reason',trim(reason_value)) from public.booking_validation_results where business_id=target_business_id and booking_revision_id=prior.id;
 if new_status<>'cancelled' then insert into public.booking_items(business_id,booking_id,booking_revision_id,pet_id,service_version_id,starts_at,ends_at,quantity,status) values(target_business_id,b.id,new_revision,item.pet_id,item.service_version_id,item.starts_at,item.ends_at,item.quantity,case when new_status='confirmed' then 'confirmed' else 'held' end) returning id into new_item;update public.booking_items set status='cancelled' where id=item.id;end if;
 if new_status='confirmed' then commitment:=app.convert_capacity_hold(target_business_id,prior.capacity_hold_id,new_item);update public.booking_items set capacity_commitment_id=commitment where business_id=target_business_id and id=new_item;
 elsif new_status='cancelled' then update public.capacity_holds set status='released',release_reason='Booking request rejected' where business_id=target_business_id and id=prior.capacity_hold_id and status='active';update public.booking_items set status='cancelled' where business_id=target_business_id and booking_id=b.id;end if;
 update public.bookings set status=new_status,current_revision_number=current_revision_number+1 where id=b.id;
 insert into public.booking_actions(business_id,booking_id,action_type,decision,reason,idempotency_key) values(target_business_id,b.id,'review',decision_value,trim(reason_value),request_key) returning id into existing;
 insert into public.booking_changes(business_id,booking_id,from_revision_id,to_revision_id,change_type,reason,idempotency_key,financial_impact) values(target_business_id,b.id,prior.id,new_revision,'approval',trim(reason_value),'change-'||request_key,jsonb_build_object('total_minor',q.total_minor,'deposit_due_minor',q.deposit_due_minor));
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'booking.reviewed',true,case when decision_value='approved' then 'Booking request approved.' when decision_value='rejected' then 'Booking request declined.' else 'Changes requested.' end,jsonb_build_object('decision',decision_value,'status',new_status,'reason',trim(reason_value)),auth.uid());return existing;
end; $$;

create or replace function app.confirm_booking_deposit(target_business_id uuid,target_booking_id uuid,payment_reference_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;b public.bookings%rowtype;prior public.booking_revisions%rowtype;item public.booking_items%rowtype;new_revision uuid;new_item uuid;commitment uuid;
begin
 if not app.member_has_permission(target_business_id,'payments.collect') or char_length(trim(payment_reference_value))<6 then raise exception 'deposit confirmation unavailable' using errcode='42501';end if;
 select id into existing from public.booking_actions where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id and status='pending_deposit' for update;
 if b.id is null or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'deposit-pending booking unavailable' using errcode='P0002';end if;
 select * into prior from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 select * into item from public.booking_items where business_id=target_business_id and booking_id=b.id and status='held' order by created_at desc limit 1;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,capacity_hold_id,change_reason,customer_authority_snapshot,validation_snapshot)
 values(target_business_id,b.id,b.current_revision_number+1,'confirmed',prior.quote_id,prior.policy_version_id,prior.capacity_hold_id,'Verified deposit confirmed',prior.customer_authority_snapshot,jsonb_build_object('payment_reference',trim(payment_reference_value),'prior_validation',prior.validation_snapshot)) returning id into new_revision;
 insert into public.booking_validation_results(business_id,booking_revision_id,check_type,outcome,blocking,customer_message,details)
 select business_id,new_revision,check_type,case when check_type='payment' then 'passed' else outcome end,case when check_type='payment' then false else blocking end,case when check_type='payment' then 'Required deposit was verified.' else customer_message end,details||jsonb_build_object('payment_reference',trim(payment_reference_value)) from public.booking_validation_results where business_id=target_business_id and booking_revision_id=prior.id;
 insert into public.booking_items(business_id,booking_id,booking_revision_id,pet_id,service_version_id,starts_at,ends_at,quantity,status) values(target_business_id,b.id,new_revision,item.pet_id,item.service_version_id,item.starts_at,item.ends_at,item.quantity,'confirmed') returning id into new_item;
 commitment:=app.convert_capacity_hold(target_business_id,prior.capacity_hold_id,new_item);update public.booking_items set status='cancelled' where id=item.id;update public.booking_items set capacity_commitment_id=commitment where id=new_item;update public.bookings set status='confirmed',current_revision_number=current_revision_number+1 where id=b.id;
 insert into public.booking_actions(business_id,booking_id,action_type,decision,reason,external_reference,idempotency_key) values(target_business_id,b.id,'deposit_confirmation','confirmed','Verified provider payment outcome',trim(payment_reference_value),request_key) returning id into existing;
 insert into public.booking_changes(business_id,booking_id,from_revision_id,to_revision_id,change_type,reason,idempotency_key,financial_impact) values(target_business_id,b.id,prior.id,new_revision,'deposit_confirmation','Verified provider payment outcome','change-'||request_key,jsonb_build_object('payment_reference',trim(payment_reference_value)));
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'booking.confirmed',true,'Deposit received and booking confirmed.',jsonb_build_object('payment_reference',trim(payment_reference_value),'capacity_commitment_id',commitment),auth.uid());return existing;
end; $$;

create or replace function app.reschedule_booking(target_business_id uuid,target_booking_id uuid,new_start timestamptz,new_end timestamptz,requested_units integer,coupon_value text,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;b public.bookings%rowtype;prior public.booking_revisions%rowtype;old_item public.booking_items%rowtype;svc_id uuid;explanation jsonb;new_hold uuid;new_quote uuid;q public.quotes%rowtype;new_revision uuid;new_item uuid;new_commitment uuid;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') or char_length(trim(reason_value))<8 then raise exception 'booking modification unavailable' using errcode='42501';end if;
 select to_revision_id into existing from public.booking_changes where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id and status='confirmed' for update;
 if b.id is null or not app.member_can_access_location(target_business_id,b.location_id) or new_end<=new_start or requested_units<1 then raise exception 'modifiable booking unavailable' using errcode='P0002';end if;
 select * into prior from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 select * into old_item from public.booking_items where business_id=target_business_id and booking_id=b.id and status='confirmed' order by created_at desc limit 1;
 select v.service_id into svc_id from public.service_versions v where v.business_id=target_business_id and v.id=old_item.service_version_id;
 explanation:=app.explain_service_availability(target_business_id,b.location_id,svc_id,old_item.pet_id,new_start,new_end,old_item.quantity);
 if not (explanation->>'available')::boolean or (explanation->>'requires_review')::boolean then raise exception 'replacement schedule unavailable' using errcode='P0001';end if;
 new_hold:=app.create_capacity_hold(target_business_id,(explanation->>'capacity_pool_id')::uuid,new_start,new_end,old_item.quantity,15,'reschedule-hold-'||request_key);
 new_quote:=app.calculate_quote_with_adjustments(target_business_id,b.location_id,old_item.pet_id,svc_id,new_start,new_end,old_item.quantity,requested_units,'reschedule-quote-'||request_key,coupon_value,prior.quote_id);
 select * into q from public.quotes where business_id=target_business_id and id=new_quote;if q.deposit_due_minor>0 then raise exception 'reschedule requires payment reconciliation' using errcode='P0001';end if;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,capacity_hold_id,change_reason,customer_authority_snapshot,validation_snapshot)
 values(target_business_id,b.id,b.current_revision_number+1,'confirmed',new_quote,q.policy_version_id,new_hold,trim(reason_value),prior.customer_authority_snapshot,explanation) returning id into new_revision;
 insert into public.booking_validation_results(business_id,booking_revision_id,check_type,outcome,blocking,customer_message,details) values
 (target_business_id,new_revision,'authority','passed',false,'Booking authority remains verified.',prior.customer_authority_snapshot),
 (target_business_id,new_revision,'eligibility','passed',false,'Pet requirements passed for the replacement dates.',explanation),
 (target_business_id,new_revision,'capacity','passed',false,'Replacement capacity was secured before release.',jsonb_build_object('hold_id',new_hold)),
 (target_business_id,new_revision,'pricing','passed',false,'Replacement pricing is complete.',jsonb_build_object('quote_id',new_quote,'total_minor',q.total_minor)),
 (target_business_id,new_revision,'payment','passed',false,'No additional deposit reconciliation is required.',jsonb_build_object('deposit_due_minor',q.deposit_due_minor));
 insert into public.booking_items(business_id,booking_id,booking_revision_id,pet_id,service_version_id,starts_at,ends_at,quantity,status) values(target_business_id,b.id,new_revision,old_item.pet_id,old_item.service_version_id,new_start,new_end,old_item.quantity,'confirmed') returning id into new_item;
 new_commitment:=app.convert_capacity_hold(target_business_id,new_hold,new_item);update public.booking_items set capacity_commitment_id=new_commitment where id=new_item;
 update public.capacity_commitments set status='released' where business_id=target_business_id and id=old_item.capacity_commitment_id and status='active';update public.booking_items set status='cancelled' where id=old_item.id;
 update public.bookings set current_revision_number=current_revision_number+1 where id=b.id;
 insert into public.booking_changes(business_id,booking_id,from_revision_id,to_revision_id,change_type,reason,idempotency_key,financial_impact) values(target_business_id,b.id,prior.id,new_revision,'reschedule',trim(reason_value),request_key,jsonb_build_object('prior_quote_id',prior.quote_id,'new_quote_id',new_quote,'new_total_minor',q.total_minor));
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'booking.rescheduled',true,'Booking dates changed.',jsonb_build_object('old_start',old_item.starts_at,'old_end',old_item.ends_at,'new_start',new_start,'new_end',new_end,'reason',trim(reason_value)),auth.uid());return new_revision;
end; $$;

create or replace function app.offer_waitlist_entry(target_business_id uuid,target_entry_id uuid,deadline_minutes integer,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;e public.waitlist_entries%rowtype;explanation jsonb;hold_id uuid;created_id uuid;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'waitlist promotion unavailable' using errcode='42501';end if;
 select id into existing from public.waitlist_offers where business_id=target_business_id and idempotency_key=request_key;if existing is not null then return existing;end if;
 select * into e from public.waitlist_entries where business_id=target_business_id and id=target_entry_id and status='active' for update;
 if e.id is null or deadline_minutes not between 5 and 30 or not app.member_can_access_location(target_business_id,e.location_id) then raise exception 'active waitlist entry unavailable' using errcode='P0002';end if;
 explanation:=app.explain_service_availability(target_business_id,e.location_id,e.service_id,e.pet_id,e.preferred_start,e.preferred_end,e.quantity);
 if not (explanation->>'available')::boolean then raise exception 'waitlist match unavailable' using errcode='P0001';end if;
 hold_id:=app.create_capacity_hold(target_business_id,(explanation->>'capacity_pool_id')::uuid,e.preferred_start,e.preferred_end,e.quantity,least(deadline_minutes,30),'waitlist-hold-'||request_key);
 insert into public.waitlist_offers(business_id,waitlist_entry_id,capacity_hold_id,offered_start,offered_end,deadline_at,match_explanation,idempotency_key)
 values(target_business_id,e.id,hold_id,e.preferred_start,e.preferred_end,now()+make_interval(mins=>deadline_minutes),explanation,request_key) returning id into created_id;
 update public.waitlist_entries set status='offered' where id=e.id;return created_id;
end; $$;

create or replace function app.accept_waitlist_offer(target_business_id uuid,target_offer_id uuid,requested_units integer,coupon_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;o public.waitlist_offers%rowtype;e public.waitlist_entries%rowtype;version_id uuid;confirmation text;eligibility record;quote_id uuid;q public.quotes%rowtype;booking_id uuid;revision_id uuid;item_id uuid;commitment uuid;booking_status text;authority jsonb;
begin
 if not app.member_has_permission(target_business_id,'bookings.create') then raise exception 'waitlist acceptance unavailable' using errcode='42501';end if;
 select id into existing from public.bookings where business_id=target_business_id and idempotency_key='waitlist-'||request_key;if existing is not null then return existing;end if;
 select * into o from public.waitlist_offers where business_id=target_business_id and id=target_offer_id and status='offered' and deadline_at>now() for update;
 if o.id is null then raise exception 'active waitlist offer unavailable' using errcode='P0002';end if;
 select * into e from public.waitlist_entries where business_id=target_business_id and id=o.waitlist_entry_id for update;
 if not app.member_can_access_location(target_business_id,e.location_id) or not exists(select 1 from public.capacity_holds where business_id=target_business_id and id=o.capacity_hold_id and status='active' and expires_at>now()) then raise exception 'waitlist offer capacity expired' using errcode='P0001';end if;
 select v.id,v.confirmation_mode into version_id,confirmation from public.services s join public.service_versions v on v.business_id=s.business_id and v.service_id=s.id and v.status='published' where s.business_id=target_business_id and s.id=e.service_id and s.status='active';
 select * into eligibility from app.evaluate_pet_service_eligibility(target_business_id,e.pet_id,version_id,o.offered_start::date);if version_id is null or not eligibility.eligible then raise exception 'waitlist eligibility unavailable' using errcode='P0001';end if;
 select jsonb_build_object('customer_id',c.id,'household_id',p.household_id,'relationship',hm.role) into authority from public.customers c join public.household_members hm on hm.business_id=c.business_id and hm.customer_id=c.id join public.pets p on p.business_id=hm.business_id and p.household_id=hm.household_id and p.id=e.pet_id and p.status='active' where c.business_id=target_business_id and c.id=e.customer_id and c.status='active' limit 1;
 if authority is null then raise exception 'customer booking authority unavailable' using errcode='42501';end if;
 quote_id:=app.calculate_quote_with_adjustments(target_business_id,e.location_id,e.pet_id,e.service_id,o.offered_start,o.offered_end,e.quantity,requested_units,'waitlist-quote-'||request_key,coupon_value,null);select * into q from public.quotes where business_id=target_business_id and id=quote_id;
 booking_status:=case when eligibility.requires_review then 'action_required' when confirmation in('staff_approval','request_only') then 'pending_approval' when q.deposit_due_minor>0 then 'pending_deposit' else 'confirmed' end;
 insert into public.bookings(business_id,location_id,customer_id,booking_number,status,source_channel,idempotency_key) values(target_business_id,e.location_id,e.customer_id,app.next_booking_number(target_business_id),booking_status,'waitlist','waitlist-'||request_key) returning id into booking_id;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,capacity_hold_id,customer_authority_snapshot,validation_snapshot) values(target_business_id,booking_id,1,booking_status,quote_id,q.policy_version_id,o.capacity_hold_id,authority,jsonb_build_object('waitlist_offer_id',o.id,'eligible',eligibility.eligible,'requires_review',eligibility.requires_review,'reasons',eligibility.reasons)) returning id into revision_id;
 insert into public.booking_items(business_id,booking_id,booking_revision_id,pet_id,service_version_id,starts_at,ends_at,quantity,status) values(target_business_id,booking_id,revision_id,e.pet_id,version_id,o.offered_start,o.offered_end,e.quantity,case when booking_status='confirmed' then 'confirmed' else 'held' end) returning id into item_id;
 insert into public.booking_validation_results(business_id,booking_revision_id,check_type,outcome,blocking,customer_message,details) values
 (target_business_id,revision_id,'authority','passed',false,'Booking authority verified.',authority),
 (target_business_id,revision_id,'eligibility',case when eligibility.requires_review then 'review' else 'passed' end,eligibility.requires_review,case when eligibility.requires_review then 'One or more requirements need staff review.' else 'Pet requirements passed.' end,jsonb_build_object('reasons',eligibility.reasons)),
 (target_business_id,revision_id,'capacity','passed',false,'Offered capacity remains held.',jsonb_build_object('hold_id',o.capacity_hold_id,'offer_id',o.id)),
 (target_business_id,revision_id,'pricing','passed',false,'Pricing was recalculated for this offer.',jsonb_build_object('quote_id',quote_id,'total_minor',q.total_minor)),
 (target_business_id,revision_id,'payment',case when q.deposit_due_minor>0 then 'pending' else 'passed' end,q.deposit_due_minor>0,case when q.deposit_due_minor>0 then 'A deposit is required before confirmation.' else 'No deposit is required.' end,jsonb_build_object('deposit_due_minor',q.deposit_due_minor));
 if booking_status='confirmed' then commitment:=app.convert_capacity_hold(target_business_id,o.capacity_hold_id,item_id);update public.booking_items set capacity_commitment_id=commitment where id=item_id;end if;
 update public.waitlist_offers set status='accepted',booking_id=booking_id where id=o.id;update public.waitlist_entries set status='converted' where id=e.id;
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,booking_id,'waitlist.entry.converted',true,'Waitlist offer converted to a booking request.',jsonb_build_object('offer_id',o.id,'status',booking_status),auth.uid());
 if booking_status='confirmed' then insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,booking_id,'booking.confirmed',true,'Booking confirmed.',jsonb_build_object('capacity_commitment_id',commitment),auth.uid());end if;return booking_id;
end; $$;

create or replace function app.decline_waitlist_offer(target_business_id uuid,target_offer_id uuid,reason_value text)
returns void language plpgsql security definer set search_path='' as $$ declare o public.waitlist_offers%rowtype;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'waitlist offer unavailable' using errcode='42501';end if;
 select * into o from public.waitlist_offers where business_id=target_business_id and id=target_offer_id and status='offered' for update;if o.id is null then raise exception 'active waitlist offer unavailable' using errcode='P0002';end if;
 update public.waitlist_offers set status='declined',match_explanation=match_explanation||jsonb_build_object('decline_reason',trim(reason_value)) where id=o.id;
 update public.capacity_holds set status='released',release_reason='Waitlist offer declined' where business_id=target_business_id and id=o.capacity_hold_id and status='active';
 update public.waitlist_entries set status='active' where business_id=target_business_id and id=o.waitlist_entry_id;end; $$;

create or replace function app.expire_waitlist_offers(target_business_id uuid)
returns integer language plpgsql security definer set search_path='' as $$ declare affected integer;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'waitlist maintenance unavailable' using errcode='42501';end if;
 with expired as(update public.waitlist_offers set status='expired' where business_id=target_business_id and status='offered' and deadline_at<=now() returning waitlist_entry_id,capacity_hold_id)
 update public.waitlist_entries e set status='active' from expired x where e.business_id=target_business_id and e.id=x.waitlist_entry_id;
 get diagnostics affected=row_count;
 update public.capacity_holds h set status='expired',release_reason='Waitlist offer expired' where h.business_id=target_business_id and h.status='active' and exists(select 1 from public.waitlist_offers o where o.business_id=h.business_id and o.capacity_hold_id=h.id and o.status='expired');return affected;
end; $$;

do $$declare n text;begin foreach n in array array['booking_actions','booking_changes','waitlist_offers'] loop execute format('alter table public.%I enable row level security',n);execute format('alter table public.%I force row level security',n);end loop;end$$;
create policy booking_actions_view on public.booking_actions for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_actions.business_id and b.id=booking_actions.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy booking_changes_view on public.booking_changes for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_changes.business_id and b.id=booking_changes.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy waitlist_offers_view on public.waitlist_offers for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.waitlist_entries e where e.business_id=waitlist_offers.business_id and e.id=waitlist_offers.waitlist_entry_id and app.member_can_access_location(e.business_id,e.location_id)));
revoke all on public.booking_actions,public.booking_changes,public.waitlist_offers from anon,authenticated;grant select on public.booking_actions,public.booking_changes,public.waitlist_offers to authenticated;
revoke all on function app.resolve_booking_review(uuid,uuid,text,text,text),app.confirm_booking_deposit(uuid,uuid,text,text),app.reschedule_booking(uuid,uuid,timestamptz,timestamptz,integer,text,text,text),app.offer_waitlist_entry(uuid,uuid,integer,text),app.accept_waitlist_offer(uuid,uuid,integer,text,text),app.decline_waitlist_offer(uuid,uuid,text),app.expire_waitlist_offers(uuid) from public;
grant execute on function app.resolve_booking_review(uuid,uuid,text,text,text),app.confirm_booking_deposit(uuid,uuid,text,text),app.reschedule_booking(uuid,uuid,timestamptz,timestamptz,integer,text,text,text),app.offer_waitlist_entry(uuid,uuid,integer,text),app.accept_waitlist_offer(uuid,uuid,integer,text,text),app.decline_waitlist_offer(uuid,uuid,text),app.expire_waitlist_offers(uuid) to authenticated;
