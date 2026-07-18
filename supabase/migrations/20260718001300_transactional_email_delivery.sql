-- PetCare E08 reliable transactional-email claiming, delivery, and recovery.
alter table public.transactional_message_outbox
 add column delivery_provider text,
 add column provider_message_id text,
 add column last_attempt_at timestamptz;

create or replace function app.claim_transactional_email(batch_size integer default 20)
returns table(message_id uuid,business_id uuid,recipient_email text,recipient_name text,business_name text,message_type text,template_data jsonb,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
 return query
 with selected as (
   select o.id from public.transactional_message_outbox o
   where o.channel='email' and o.status in('pending','failed') and o.next_attempt_at<=now() and o.attempt_count<5
   order by o.next_attempt_at,o.created_at for update skip locked limit greatest(1,least(batch_size,100))
 ), claimed as (
   update public.transactional_message_outbox o set status='processing',attempt_count=o.attempt_count+1,last_attempt_at=now()
   from selected s where o.id=s.id returning o.*
 )
 select c.id,c.business_id,u.email,trim(concat_ws(' ',u.first_name,u.last_name)),b.legal_name,c.message_type,c.template_data,c.attempt_count
 from claimed c join public.customers u on u.business_id=c.business_id and u.id=c.customer_id join public.businesses b on b.id=c.business_id;
end;$$;

create or replace function app.complete_transactional_email(target_message_id uuid,was_sent boolean,provider_value text,provider_identifier text,error_category text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.transactional_message_outbox set
  status=case when was_sent then 'sent' else 'failed' end,
  delivery_provider=nullif(trim(provider_value),''),provider_message_id=case when was_sent then nullif(trim(provider_identifier),'') else provider_message_id end,
  last_error_category=case when was_sent then null else coalesce(nullif(trim(error_category),''),'delivery_error') end,
  sent_at=case when was_sent then now() else null end,
  next_attempt_at=case when was_sent then next_attempt_at else now()+make_interval(mins=>least(60,power(2,greatest(attempt_count-1,0))::integer)) end
 where id=target_message_id and channel='email' and status='processing';
end;$$;

create or replace function app.requeue_transactional_email(target_business_id uuid,target_message_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not app.member_has_permission(target_business_id,'payments.manage') then raise exception 'message recovery unavailable' using errcode='42501';end if;
 update public.transactional_message_outbox set status='pending',attempt_count=0,next_attempt_at=now(),last_error_category=null
 where business_id=target_business_id and id=target_message_id and channel='email' and status in('failed','suppressed');
 if not found then raise exception 'recoverable message unavailable' using errcode='P0002';end if;
end;$$;

revoke all on function app.claim_transactional_email(integer),app.complete_transactional_email(uuid,boolean,text,text,text),app.requeue_transactional_email(uuid,uuid) from public;
grant execute on function app.claim_transactional_email(integer),app.complete_transactional_email(uuid,boolean,text,text,text) to service_role;
grant execute on function app.requeue_transactional_email(uuid,uuid) to authenticated;
