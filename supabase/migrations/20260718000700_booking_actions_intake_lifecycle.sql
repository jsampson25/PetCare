-- PetCare E07 action, intake, no-show, and request-expiry completion.

create table public.booking_action_items (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, booking_id uuid not null,
  booking_revision_id uuid not null, action_type text not null check (action_type in ('intake','eligibility_review','approval','deposit','document','customer_response')),
  audience text not null check (audience in ('customer','staff','manager')), status text not null default 'open' check (status in ('open','resolved','expired','cancelled')),
  blocking boolean not null default true, title text not null check (char_length(trim(title)) between 2 and 160),
  due_at timestamptz, metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  resolved_by uuid references auth.users(id) on delete restrict, resolved_at timestamptz, created_at timestamptz not null default now(),
  unique (business_id,id), foreign key (business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
  foreign key (business_id,booking_revision_id) references public.booking_revisions(business_id,id) on delete restrict,
  check ((status='resolved')=(resolved_at is not null))
);
create unique index booking_action_open_type_idx on public.booking_action_items(business_id,booking_revision_id,action_type)
  where status='open' and action_type<>'intake';
create index booking_action_queue_idx on public.booking_action_items(business_id,audience,status,due_at);

create table public.booking_intake_answers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, booking_id uuid not null,
  booking_revision_id uuid not null, booking_item_id uuid not null, service_question_id uuid not null,
  question_key text not null, prompt_snapshot text not null, response_type text not null,
  answer jsonb not null, supersedes_answer_id uuid, idempotency_key text not null,
  answered_by uuid not null references auth.users(id) on delete restrict default auth.uid(), answered_at timestamptz not null default now(),
  unique (business_id,id), unique (business_id,idempotency_key),
  foreign key (business_id,booking_id) references public.bookings(business_id,id) on delete restrict,
  foreign key (business_id,booking_revision_id) references public.booking_revisions(business_id,id) on delete restrict,
  foreign key (business_id,booking_item_id) references public.booking_items(business_id,id) on delete restrict,
  foreign key (business_id,service_question_id) references public.service_booking_questions(business_id,id) on delete restrict,
  foreign key (business_id,supersedes_answer_id) references public.booking_intake_answers(business_id,id) on delete restrict
);
create index booking_intake_latest_idx on public.booking_intake_answers(business_id,booking_revision_id,service_question_id,answered_at desc);

alter table public.booking_items drop constraint booking_items_status_check;
alter table public.booking_items add constraint booking_items_status_check check(status in('requested','held','confirmed','cancelled','completed','no_show','expired'));
alter table public.booking_changes drop constraint booking_changes_change_type_check;
alter table public.booking_changes add constraint booking_changes_change_type_check check(change_type in('approval','deposit_confirmation','reschedule','no_show','request_expiry'));

create trigger booking_action_tenant before update on public.booking_action_items for each row execute function app.prevent_business_id_change();
create trigger booking_intake_immutable before update or delete on public.booking_intake_answers for each row execute function app.prevent_commercial_snapshot_change();
create trigger booking_actions_audit after insert or update or delete on public.booking_action_items for each row execute function app.audit_configuration_change('booking.action.changed','booking_action_item');

create or replace function app.sync_booking_action_items(target_business_id uuid,target_booking_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;r public.booking_revisions%rowtype;created_count integer:=0;title_value text;type_value text;audience_value text;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'booking actions unavailable' using errcode='42501';end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id;
 if b.id is null or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'booking unavailable' using errcode='P0002';end if;
 select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 if b.status in('action_required','pending_approval','pending_deposit') then
   type_value:=case b.status when 'action_required' then 'eligibility_review' when 'pending_approval' then 'approval' else 'deposit' end;
   audience_value:=case when b.status='pending_deposit' then 'customer' else 'manager' end;
   title_value:=case b.status when 'action_required' then 'Resolve booking requirements' when 'pending_approval' then 'Review booking request' else 'Collect required deposit' end;
   insert into public.booking_action_items(business_id,booking_id,booking_revision_id,action_type,audience,title,due_at,metadata)
   values(target_business_id,b.id,r.id,type_value,audience_value,title_value,(select expires_at from public.capacity_holds where business_id=target_business_id and id=r.capacity_hold_id),jsonb_build_object('booking_status',b.status))
   on conflict do nothing;
   get diagnostics created_count=row_count;
 end if;
 return created_count;
end;$$;

create or replace function app.save_booking_intake_answer(target_business_id uuid,target_booking_id uuid,target_question_id uuid,response jsonb,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;b public.bookings%rowtype;r public.booking_revisions%rowtype;i public.booking_items%rowtype;q public.service_booking_questions%rowtype;prior uuid;created_id uuid;valid boolean:=false;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'booking intake unavailable' using errcode='42501';end if;
 select id into existing from public.booking_intake_answers where business_id=target_business_id and idempotency_key=trim(request_key);if existing is not null then return existing;end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id;
 if b.id is null or b.status in('cancelled','no_show','completed','expired') or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'booking intake unavailable' using errcode='P0002';end if;
 select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 select * into i from public.booking_items where business_id=target_business_id and booking_revision_id=r.id order by created_at limit 1;
 select * into q from public.service_booking_questions where business_id=target_business_id and id=target_question_id and service_version_id=i.service_version_id and active;
 if q.id is null then raise exception 'booking question unavailable' using errcode='P0002';end if;
 valid:=case q.response_type when 'yes_no' then jsonb_typeof(response)='boolean' when 'number' then jsonb_typeof(response)='number'
   when 'multi_select' then jsonb_typeof(response)='array' and not exists(select 1 from jsonb_array_elements_text(response) a where not q.options ? a.value)
   when 'single_select' then jsonb_typeof(response)='string' and q.options ? (response#>>'{}')
   when 'date' then jsonb_typeof(response)='string' and (response#>>'{}') ~ '^\\d{4}-\\d{2}-\\d{2}$'
   else jsonb_typeof(response)='string' and (not q.required or length(trim(response#>>'{}'))>0) end;
 if not valid then raise exception 'invalid booking question response' using errcode='22023';end if;
 select id into prior from public.booking_intake_answers where business_id=target_business_id and booking_revision_id=r.id and service_question_id=q.id order by answered_at desc limit 1;
 insert into public.booking_intake_answers(business_id,booking_id,booking_revision_id,booking_item_id,service_question_id,question_key,prompt_snapshot,response_type,answer,supersedes_answer_id,idempotency_key)
 values(target_business_id,b.id,r.id,i.id,q.id,q.question_key,q.prompt,q.response_type,response,prior,trim(request_key)) returning id into created_id;
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id)
 values(target_business_id,b.id,'booking.intake_answered',false,'Booking intake answer recorded.',jsonb_build_object('question_key',q.question_key,'answer_id',created_id),auth.uid());
 return created_id;
end;$$;

create or replace function app.mark_booking_no_show(target_business_id uuid,target_booking_id uuid,reason_value text,request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;b public.bookings%rowtype;r public.booking_revisions%rowtype;new_revision uuid;outcome uuid;
begin
 if not app.member_has_permission(target_business_id,'bookings.cancel') then raise exception 'no-show action unavailable' using errcode='42501';end if;
 select resulting_revision_id into existing from public.booking_changes where business_id=target_business_id and idempotency_key=trim(request_key);if existing is not null then return existing;end if;
 select * into b from public.bookings where business_id=target_business_id and id=target_booking_id for update;
 if b.id is null or b.status<>'confirmed' or not app.member_can_access_location(target_business_id,b.location_id) then raise exception 'confirmed booking unavailable' using errcode='P0002';end if;
 select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
 if not exists(select 1 from public.booking_items where business_id=target_business_id and booking_revision_id=r.id and starts_at<=now()) then raise exception 'booking has not started' using errcode='22023';end if;
 outcome:=app.calculate_cancellation_outcome(target_business_id,r.quote_id,'no_show',now(),trim(request_key)||'-outcome');
 update public.capacity_commitments set status='released' where business_id=target_business_id and booking_item_id in(select id from public.booking_items where business_id=target_business_id and booking_revision_id=r.id) and status='active';
 update public.booking_items set status='no_show' where business_id=target_business_id and booking_revision_id=r.id and status='confirmed';
 update public.bookings set status='no_show',current_revision_number=current_revision_number+1 where id=b.id;
 insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,change_reason,customer_authority_snapshot,validation_snapshot)
 values(target_business_id,b.id,b.current_revision_number+1,'no_show',r.quote_id,r.policy_version_id,trim(reason_value),r.customer_authority_snapshot,jsonb_build_object('cancellation_outcome_id',outcome,'request_key',trim(request_key))) returning id into new_revision;
 insert into public.booking_changes(business_id,booking_id,change_type,from_revision_id,resulting_revision_id,reason,idempotency_key,details)
 values(target_business_id,b.id,'no_show',r.id,new_revision,trim(reason_value),trim(request_key),jsonb_build_object('cancellation_outcome_id',outcome));
 update public.booking_action_items set status='cancelled' where business_id=target_business_id and booking_id=b.id and status='open';
 insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'booking.no_show',true,'Booking marked as a no-show.',jsonb_build_object('reason',trim(reason_value),'cancellation_outcome_id',outcome),auth.uid());
 return new_revision;
end;$$;

create or replace function app.expire_booking_requests(target_business_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare b record;r public.booking_revisions%rowtype;new_revision uuid;expired_count integer:=0;key_value text;
begin
 if not app.member_has_permission(target_business_id,'bookings.modify') then raise exception 'booking expiry unavailable' using errcode='42501';end if;
 for b in select bk.* from public.bookings bk join public.booking_revisions br on br.business_id=bk.business_id and br.booking_id=bk.id and br.revision_number=bk.current_revision_number join public.capacity_holds h on h.business_id=br.business_id and h.id=br.capacity_hold_id where bk.business_id=target_business_id and bk.status in('action_required','pending_approval','pending_deposit') and h.expires_at<=now() for update of bk loop
   select * into r from public.booking_revisions where business_id=target_business_id and booking_id=b.id and revision_number=b.current_revision_number;
   key_value:='request-expiry-'||b.id::text||'-'||b.current_revision_number::text;
   update public.capacity_holds set status='expired',release_reason='Booking request expired' where business_id=target_business_id and id=r.capacity_hold_id and status='active';
   update public.booking_items set status='expired' where business_id=target_business_id and booking_revision_id=r.id and status='held';
   update public.bookings set status='expired',current_revision_number=current_revision_number+1 where id=b.id;
   insert into public.booking_revisions(business_id,booking_id,revision_number,status,quote_id,policy_version_id,change_reason,customer_authority_snapshot,validation_snapshot)
   values(target_business_id,b.id,b.current_revision_number+1,'expired',r.quote_id,r.policy_version_id,'Capacity hold expired before confirmation.',r.customer_authority_snapshot,jsonb_build_object('request_key',key_value)) returning id into new_revision;
   insert into public.booking_changes(business_id,booking_id,change_type,from_revision_id,resulting_revision_id,reason,idempotency_key,details) values(target_business_id,b.id,'request_expiry',r.id,new_revision,'Capacity hold expired before confirmation.',key_value,'{}');
   update public.booking_action_items set status='expired' where business_id=target_business_id and booking_id=b.id and status='open';
   insert into public.booking_timeline_events(business_id,booking_id,event_type,customer_visible,summary,details,actor_id) values(target_business_id,b.id,'booking.expired',true,'Booking request expired before confirmation.','{}',auth.uid());
   expired_count:=expired_count+1;
 end loop;
 return expired_count;
end;$$;

alter table public.booking_action_items enable row level security;alter table public.booking_action_items force row level security;
alter table public.booking_intake_answers enable row level security;alter table public.booking_intake_answers force row level security;
create policy booking_actions_view on public.booking_action_items for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_action_items.business_id and b.id=booking_action_items.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
create policy booking_intake_view on public.booking_intake_answers for select to authenticated using(app.member_has_permission(business_id,'bookings.view') and exists(select 1 from public.bookings b where b.business_id=booking_intake_answers.business_id and b.id=booking_intake_answers.booking_id and app.member_can_access_location(b.business_id,b.location_id)));
revoke all on public.booking_action_items,public.booking_intake_answers from anon,authenticated;grant select on public.booking_action_items,public.booking_intake_answers to authenticated;
revoke all on function app.sync_booking_action_items(uuid,uuid),app.save_booking_intake_answer(uuid,uuid,uuid,jsonb,text),app.mark_booking_no_show(uuid,uuid,text,text),app.expire_booking_requests(uuid) from public;
grant execute on function app.sync_booking_action_items(uuid,uuid),app.save_booking_intake_answer(uuid,uuid,uuid,jsonb,text),app.mark_booking_no_show(uuid,uuid,text,text),app.expire_booking_requests(uuid) to authenticated;
