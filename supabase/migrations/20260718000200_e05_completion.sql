-- PetCare E05 completion: revisions, immutable version children, resources, and explanations.

create or replace function app.prevent_published_service_child_change()
returns trigger language plpgsql set search_path='' as $$
declare version_id uuid; version_state text;
begin
  version_id := case when tg_op='DELETE' then old.service_version_id else new.service_version_id end;
  select status into version_state from public.service_versions where id=version_id;
  if version_state <> 'draft' then
    raise exception 'published service configuration is immutable' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;

create trigger service_questions_immutable before insert or update or delete on public.service_booking_questions
for each row execute function app.prevent_published_service_child_change();
create trigger service_requirements_immutable before insert or update or delete on public.service_requirements
for each row execute function app.prevent_published_service_child_change();

create or replace function app.create_service_revision(target_business_id uuid,target_service_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare source public.service_versions%rowtype; created_id uuid; next_number integer;
begin
  if not app.member_has_permission(target_business_id,'services.manage') then raise exception 'service management unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.service_versions where business_id=target_business_id and service_id=target_service_id and status='draft') then
    raise exception 'service already has a draft revision' using errcode='23505';
  end if;
  select * into source from public.service_versions where business_id=target_business_id and service_id=target_service_id and status='published';
  if source.id is null then raise exception 'published service version unavailable' using errcode='P0002'; end if;
  select coalesce(max(version_number),0)+1 into next_number from public.service_versions where business_id=target_business_id and service_id=target_service_id;
  insert into public.service_versions(
    business_id,service_id,version_number,status,customer_name,short_description,full_description,internal_instructions,
    time_model,default_duration_minutes,buffer_before_minutes,buffer_after_minutes,confirmation_mode,
    multiple_pets_allowed,separate_item_per_pet,recurring_allowed
  ) values(
    target_business_id,target_service_id,next_number,'draft',source.customer_name,source.short_description,source.full_description,source.internal_instructions,
    source.time_model,source.default_duration_minutes,source.buffer_before_minutes,source.buffer_after_minutes,source.confirmation_mode,
    source.multiple_pets_allowed,source.separate_item_per_pet,source.recurring_allowed
  ) returning id into created_id;
  insert into public.service_booking_questions(business_id,service_version_id,question_key,prompt,response_type,required,options,display_order,active)
  select business_id,created_id,question_key,prompt,response_type,required,options,display_order,active from public.service_booking_questions where business_id=target_business_id and service_version_id=source.id;
  insert into public.service_requirements(business_id,service_version_id,requirement_type,requirement_key,comparison_value,enforcement,customer_message,active)
  select business_id,created_id,requirement_type,requirement_key,comparison_value,enforcement,customer_message,active from public.service_requirements where business_id=target_business_id and service_version_id=source.id;
  return created_id;
end; $$;

create or replace function app.add_capacity_resource(
  target_business_id uuid,target_pool_id uuid,resource_code_value text,label_value text,
  resource_type_value text,max_pets_value integer,attributes_value jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id,'capacity.manage') or not exists(
    select 1 from public.capacity_pools where business_id=target_business_id and id=target_pool_id and app.member_can_access_location(business_id,location_id)
  ) then raise exception 'capacity management unavailable' using errcode='42501'; end if;
  insert into public.capacity_resources(business_id,capacity_pool_id,resource_code,label,resource_type,max_pets,attributes)
  values(target_business_id,target_pool_id,upper(trim(resource_code_value)),trim(label_value),resource_type_value,max_pets_value,coalesce(attributes_value,'{}'::jsonb))
  returning id into created_id; return created_id;
end; $$;

create or replace function app.set_capacity_resource_status(
  target_business_id uuid,target_resource_id uuid,new_status text
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app.member_has_permission(target_business_id,'capacity.manage') then raise exception 'capacity management unavailable' using errcode='42501'; end if;
  if new_status not in ('ready','cleaning','maintenance','out_of_service','retired') then raise exception 'invalid resource status' using errcode='22023'; end if;
  update public.capacity_resources r set status=new_status where r.business_id=target_business_id and r.id=target_resource_id and exists(
    select 1 from public.capacity_pools p where p.business_id=r.business_id and p.id=r.capacity_pool_id and app.member_can_access_location(p.business_id,p.location_id)
  );
  if not found then raise exception 'resource unavailable' using errcode='P0002'; end if;
end; $$;

create or replace function app.capacity_available(
  target_business_id uuid,target_pool_id uuid,requested_start timestamptz,requested_end timestamptz
) returns integer language plpgsql security definer set search_path='' as $$
declare configured integer; location uuid; model text; effective integer; ready_capacity integer; used integer;
begin
  if not app.member_has_permission(target_business_id,'capacity.view') then raise exception 'capacity unavailable' using errcode='42501'; end if;
  select configured_capacity,location_id,capacity_model into configured,location,model from public.capacity_pools
  where business_id=target_business_id and id=target_pool_id and status='active' and app.member_can_access_location(business_id,location_id);
  if configured is null or requested_end<=requested_start then return 0; end if;
  if exists(select 1 from public.location_closures where business_id=target_business_id and location_id=location and closure_date between requested_start::date and (requested_end-interval '1 second')::date) then return 0; end if;
  select coalesce(min(capacity),configured) into effective from public.capacity_overrides where business_id=target_business_id and capacity_pool_id=target_pool_id and starts_on<=requested_start::date and ends_on>=(requested_end-interval '1 second')::date;
  if model='named_resource' then
    select coalesce(sum(max_pets),0) into ready_capacity from public.capacity_resources where business_id=target_business_id and capacity_pool_id=target_pool_id and status='ready';
    effective:=least(effective,ready_capacity);
  end if;
  select coalesce(sum(quantity),0) into used from (
    select quantity from public.capacity_holds where business_id=target_business_id and capacity_pool_id=target_pool_id and status='active' and expires_at>now() and starts_at<requested_end and ends_at>requested_start
    union all select quantity from public.capacity_commitments where business_id=target_business_id and capacity_pool_id=target_pool_id and status='active' and starts_at<requested_end and ends_at>requested_start
  ) usage;
  return greatest(effective-used,0);
end; $$;

create or replace function app.release_capacity_hold(target_business_id uuid,target_hold_id uuid,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare held public.capacity_holds%rowtype;
begin
  select * into held from public.capacity_holds where business_id=target_business_id and id=target_hold_id;
  if held.id is null or not (held.held_by=auth.uid() or app.member_has_permission(target_business_id,'capacity.manage')) then
    raise exception 'capacity hold unavailable' using errcode='P0002';
  end if;
  if held.status in ('released','expired','converted') then return; end if;
  update public.capacity_holds set status=case when expires_at<=now() then 'expired' else 'released' end,release_reason=nullif(trim(reason),'') where id=held.id;
end; $$;

create or replace function app.expire_capacity_holds(target_business_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  if not app.member_has_permission(target_business_id,'capacity.manage') then raise exception 'capacity management unavailable' using errcode='42501'; end if;
  update public.capacity_holds set status='expired',release_reason=coalesce(release_reason,'Hold timeout')
  where status='active' and expires_at<=now() and business_id=target_business_id;
  get diagnostics affected=row_count; return affected;
end; $$;

create or replace function app.explain_service_availability(
  target_business_id uuid,target_location_id uuid,target_service_id uuid,target_pet_id uuid,
  requested_start timestamptz,requested_end timestamptz,requested_quantity integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare service_state text; version_id uuid; pool record; eligibility record; remaining integer; reasons jsonb:='[]'::jsonb; eligible boolean:=true; review boolean:=false;
begin
  if not app.member_has_permission(target_business_id,'capacity.view') or not app.member_has_permission(target_business_id,'pets.view')
    or not app.member_can_access_location(target_business_id,target_location_id) then raise exception 'availability unavailable' using errcode='42501'; end if;
  if requested_quantity<1 or requested_end<=requested_start then raise exception 'invalid availability request' using errcode='22023'; end if;
  select s.status,v.id into service_state,version_id from public.services s join public.service_versions v on v.business_id=s.business_id and v.service_id=s.id and v.status='published'
  where s.business_id=target_business_id and s.id=target_service_id;
  if service_state is null then reasons:=reasons||jsonb_build_array(jsonb_build_object('code','service_not_published','message','This service is not published.')); eligible:=false;
  elsif service_state<>'active' then reasons:=reasons||jsonb_build_array(jsonb_build_object('code','service_not_active','message','This service is not currently accepting requests.')); eligible:=false; end if;
  if not exists(select 1 from public.service_location_enablements where business_id=target_business_id and service_id=target_service_id and location_id=target_location_id and enabled and staff_entry) then
    reasons:=reasons||jsonb_build_array(jsonb_build_object('code','location_not_enabled','message','This service is not enabled at the selected location.')); eligible:=false;
  end if;
  if version_id is not null then
    select * into eligibility from app.evaluate_pet_service_eligibility(target_business_id,target_pet_id,version_id,requested_start::date);
    eligible:=eligible and eligibility.eligible; review:=eligibility.requires_review; reasons:=reasons||eligibility.reasons;
  end if;
  select * into pool from public.capacity_pools where business_id=target_business_id and location_id=target_location_id and service_id=target_service_id and status='active' order by created_at limit 1;
  if pool.id is null then remaining:=0; reasons:=reasons||jsonb_build_array(jsonb_build_object('code','capacity_not_configured','message','Capacity is not configured for this service and location.')); eligible:=false;
  else remaining:=app.capacity_available(target_business_id,pool.id,requested_start,requested_end);
    if remaining<requested_quantity then reasons:=reasons||jsonb_build_array(jsonb_build_object('code','capacity_unavailable','message','The requested dates do not have enough remaining capacity.')); eligible:=false; end if;
  end if;
  return jsonb_build_object('available',eligible,'requires_review',review,'remaining_capacity',coalesce(remaining,0),'service_version_id',version_id,'capacity_pool_id',pool.id,'reasons',reasons,'evaluated_at',now());
end; $$;

revoke all on function app.create_service_revision(uuid,uuid),app.add_capacity_resource(uuid,uuid,text,text,text,integer,jsonb),app.set_capacity_resource_status(uuid,uuid,text),app.expire_capacity_holds(uuid),app.explain_service_availability(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer) from public;
grant execute on function app.create_service_revision(uuid,uuid),app.add_capacity_resource(uuid,uuid,text,text,text,integer,jsonb),app.set_capacity_resource_status(uuid,uuid,text),app.expire_capacity_holds(uuid),app.explain_service_availability(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer) to authenticated;
