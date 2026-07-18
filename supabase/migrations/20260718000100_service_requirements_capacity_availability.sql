-- PetCare E05 requirements, booking questions, capacity, eligibility, and holds.

insert into public.permission_definitions (permission_key, description, risk_level) values
  ('capacity.view', 'View location capacity and availability.', 'standard'),
  ('capacity.manage', 'Configure pools, overrides, and manual capacity controls.', 'sensitive');
insert into public.role_permissions (role_key, permission_key) values
  ('owner', 'capacity.view'), ('owner', 'capacity.manage'),
  ('manager', 'capacity.view'), ('manager', 'capacity.manage'),
  ('front_desk', 'capacity.view');

create table public.service_booking_questions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null,
  service_version_id uuid not null, question_key text not null check (question_key ~ '^[a-z][a-z0-9_]*$'),
  prompt text not null check (char_length(trim(prompt)) between 2 and 300),
  response_type text not null check (response_type in ('short_text','long_text','yes_no','single_select','multi_select','date','number')),
  required boolean not null default false, options jsonb not null default '[]'::jsonb,
  display_order integer not null default 0 check (display_order >= 0), active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(), created_at timestamptz not null default now(),
  unique (business_id, id), unique (business_id, service_version_id, question_key),
  foreign key (business_id, service_version_id) references public.service_versions(business_id,id) on delete restrict,
  check (jsonb_typeof(options) = 'array'),
  check (response_type not in ('single_select','multi_select') or jsonb_array_length(options) > 0)
);

create table public.service_requirements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null,
  service_version_id uuid not null,
  requirement_type text not null check (requirement_type in ('vaccination','daycare_evaluation','minimum_age_months','maximum_weight_kg','document')),
  requirement_key text not null check (requirement_key ~ '^[a-z][a-z0-9_]*$'),
  comparison_value text not null check (char_length(trim(comparison_value)) between 1 and 120),
  enforcement text not null default 'block' check (enforcement in ('block','staff_review','warn')),
  customer_message text not null check (char_length(trim(customer_message)) between 2 and 500),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(), created_at timestamptz not null default now(),
  unique (business_id,id), unique (business_id,service_version_id,requirement_key),
  foreign key (business_id,service_version_id) references public.service_versions(business_id,id) on delete restrict
);

create table public.capacity_pools (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, location_id uuid not null, service_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  capacity_model text not null default 'pet_count' check (capacity_model in ('pet_count','service_unit','named_resource')),
  physical_maximum integer not null check (physical_maximum > 0),
  configured_capacity integer not null check (configured_capacity > 0 and configured_capacity <= physical_maximum),
  status text not null default 'active' check (status in ('active','paused','retired')),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id,id), unique (business_id,location_id,service_id,name),
  foreign key (business_id,location_id) references public.locations(business_id,id) on delete restrict,
  foreign key (business_id,service_id) references public.services(business_id,id) on delete restrict
);
create index capacity_pools_lookup_idx on public.capacity_pools(business_id,location_id,service_id,status);

create table public.capacity_resources (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, capacity_pool_id uuid not null,
  resource_code text not null check (char_length(trim(resource_code)) between 1 and 60),
  label text not null check (char_length(trim(label)) between 1 and 120),
  resource_type text not null check (resource_type in ('kennel','suite','yard','grooming_station','staff_slot','other')),
  max_pets integer not null default 1 check (max_pets > 0),
  status text not null default 'ready' check (status in ('ready','occupied','cleaning','maintenance','out_of_service','retired')),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id,id), unique (business_id,capacity_pool_id,resource_code),
  foreign key (business_id,capacity_pool_id) references public.capacity_pools(business_id,id) on delete restrict
);

create table public.capacity_overrides (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, capacity_pool_id uuid not null,
  starts_on date not null, ends_on date not null, capacity integer not null check (capacity >= 0),
  reason text not null check (char_length(trim(reason)) between 2 and 300),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(), created_at timestamptz not null default now(),
  unique (business_id,id),
  foreign key (business_id,capacity_pool_id) references public.capacity_pools(business_id,id) on delete restrict,
  check (ends_on >= starts_on)
);
create index capacity_overrides_lookup_idx on public.capacity_overrides(business_id,capacity_pool_id,starts_on,ends_on);

create table public.capacity_holds (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, capacity_pool_id uuid not null,
  starts_at timestamptz not null, ends_at timestamptz not null, quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','released','expired','converted')),
  expires_at timestamptz not null, idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  held_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  release_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id,id), unique (business_id,idempotency_key),
  foreign key (business_id,capacity_pool_id) references public.capacity_pools(business_id,id) on delete restrict,
  check (ends_at > starts_at), check (expires_at > created_at)
);
create index capacity_holds_active_idx on public.capacity_holds(business_id,capacity_pool_id,starts_at,ends_at,expires_at) where status='active';

create table public.capacity_commitments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, capacity_pool_id uuid not null,
  hold_id uuid, booking_item_id uuid, starts_at timestamptz not null, ends_at timestamptz not null,
  quantity integer not null check (quantity > 0), status text not null default 'active' check (status in ('active','released','completed')),
  capacity_snapshot jsonb not null check (jsonb_typeof(capacity_snapshot)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id,id), unique (business_id,hold_id),
  foreign key (business_id,capacity_pool_id) references public.capacity_pools(business_id,id) on delete restrict,
  foreign key (business_id,hold_id) references public.capacity_holds(business_id,id) on delete restrict,
  check (ends_at > starts_at)
);
create index capacity_commitments_active_idx on public.capacity_commitments(business_id,capacity_pool_id,starts_at,ends_at) where status='active';

create trigger capacity_pools_updated before update on public.capacity_pools for each row execute function app.set_updated_at();
create trigger capacity_resources_updated before update on public.capacity_resources for each row execute function app.set_updated_at();
create trigger capacity_holds_updated before update on public.capacity_holds for each row execute function app.set_updated_at();
create trigger capacity_commitments_updated before update on public.capacity_commitments for each row execute function app.set_updated_at();
create trigger capacity_pools_tenant before update on public.capacity_pools for each row execute function app.prevent_business_id_change();
create trigger capacity_resources_tenant before update on public.capacity_resources for each row execute function app.prevent_business_id_change();
create trigger capacity_overrides_tenant before update on public.capacity_overrides for each row execute function app.prevent_business_id_change();
create trigger capacity_holds_tenant before update on public.capacity_holds for each row execute function app.prevent_business_id_change();
create trigger capacity_commitments_tenant before update on public.capacity_commitments for each row execute function app.prevent_business_id_change();
create trigger service_questions_tenant before update on public.service_booking_questions for each row execute function app.prevent_business_id_change();
create trigger service_requirements_tenant before update on public.service_requirements for each row execute function app.prevent_business_id_change();
create trigger capacity_pools_audit after insert or update or delete on public.capacity_pools for each row execute function app.audit_configuration_change('capacity.pool_changed','capacity_pool');
create trigger capacity_resources_audit after insert or update or delete on public.capacity_resources for each row execute function app.audit_configuration_change('capacity.resource_changed','capacity_resource');
create trigger capacity_overrides_audit after insert or update or delete on public.capacity_overrides for each row execute function app.audit_configuration_change('capacity.override_changed','capacity_override');
create trigger capacity_holds_audit after insert or update or delete on public.capacity_holds for each row execute function app.audit_configuration_change('capacity.hold_changed','capacity_hold');
create trigger capacity_commitments_audit after insert or update or delete on public.capacity_commitments for each row execute function app.audit_configuration_change('capacity.commitment_changed','capacity_commitment');

create or replace function app.add_service_requirement(
  target_business_id uuid, target_service_version_id uuid, requirement_type_value text,
  requirement_key_value text, comparison_value_text text, enforcement_value text, customer_message_text text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;
begin
  if not app.member_has_permission(target_business_id,'services.manage') then raise exception 'service management unavailable' using errcode='42501'; end if;
  insert into public.service_requirements(business_id,service_version_id,requirement_type,requirement_key,comparison_value,enforcement,customer_message)
  values(target_business_id,target_service_version_id,requirement_type_value,lower(trim(requirement_key_value)),trim(comparison_value_text),enforcement_value,trim(customer_message_text))
  returning id into saved_id; return saved_id;
end; $$;

create or replace function app.add_service_booking_question(
  target_business_id uuid, target_service_version_id uuid, question_key_value text,
  prompt_value text, response_type_value text, required_value boolean, options_value jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;
begin
  if not app.member_has_permission(target_business_id,'services.manage') then raise exception 'service management unavailable' using errcode='42501'; end if;
  insert into public.service_booking_questions(business_id,service_version_id,question_key,prompt,response_type,required,options)
  values(target_business_id,target_service_version_id,lower(trim(question_key_value)),trim(prompt_value),response_type_value,required_value,coalesce(options_value,'[]'::jsonb))
  returning id into saved_id; return saved_id;
end; $$;

create or replace function app.configure_capacity_pool(
  target_business_id uuid, target_location_id uuid, target_service_id uuid,
  pool_name text, model_value text, physical_limit integer, configured_limit integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;
begin
  if not app.member_has_permission(target_business_id,'capacity.manage') or not app.member_can_access_location(target_business_id,target_location_id)
    then raise exception 'capacity management unavailable' using errcode='42501'; end if;
  insert into public.capacity_pools(business_id,location_id,service_id,name,capacity_model,physical_maximum,configured_capacity)
  values(target_business_id,target_location_id,target_service_id,trim(pool_name),model_value,physical_limit,configured_limit)
  returning id into saved_id; return saved_id;
end; $$;

create or replace function app.save_capacity_override(
  target_business_id uuid, target_pool_id uuid, start_date date, end_date date,
  override_capacity integer, override_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid; pool_max integer;
begin
  if not app.member_has_permission(target_business_id,'capacity.manage') then raise exception 'capacity management unavailable' using errcode='42501'; end if;
  select physical_maximum into pool_max from public.capacity_pools where business_id=target_business_id and id=target_pool_id and app.member_can_access_location(business_id,location_id);
  if pool_max is null or override_capacity > pool_max then raise exception 'capacity exceeds physical maximum' using errcode='23514'; end if;
  insert into public.capacity_overrides(business_id,capacity_pool_id,starts_on,ends_on,capacity,reason)
  values(target_business_id,target_pool_id,start_date,end_date,override_capacity,trim(override_reason)) returning id into saved_id;
  return saved_id;
end; $$;

create or replace function app.evaluate_pet_service_eligibility(
  target_business_id uuid, target_pet_id uuid, target_service_version_id uuid, service_date date
) returns table(eligible boolean, requires_review boolean, reasons jsonb)
language plpgsql security definer set search_path='' as $$
declare requirement record; failures jsonb := '[]'::jsonb; reviews jsonb := '[]'::jsonb; satisfied boolean; pet_birth date; latest_weight numeric;
begin
  if not app.member_has_permission(target_business_id,'pets.view') then raise exception 'eligibility unavailable' using errcode='42501'; end if;
  select birth_date into pet_birth from public.pets where business_id=target_business_id and id=target_pet_id and status='active';
  if not found then raise exception 'pet unavailable' using errcode='P0002'; end if;
  select weight_kg into latest_weight from public.pet_weight_records where business_id=target_business_id and pet_id=target_pet_id order by measured_on desc,created_at desc limit 1;
  for requirement in select * from public.service_requirements where business_id=target_business_id and service_version_id=target_service_version_id and active loop
    satisfied := case requirement.requirement_type
      when 'vaccination' then exists(select 1 from public.pet_vaccinations where business_id=target_business_id and pet_id=target_pet_id and vaccine_type=requirement.comparison_value and review_status in ('accepted','waived') and expires_on>=service_date)
      when 'daycare_evaluation' then exists(select 1 from public.pet_service_evaluations where business_id=target_business_id and pet_id=target_pet_id and evaluation_type='daycare_group_play' and status in ('approved','conditional') and (expires_on is null or expires_on>=service_date))
      when 'minimum_age_months' then pet_birth is not null and pet_birth <= service_date - make_interval(months=>requirement.comparison_value::integer)
      when 'maximum_weight_kg' then latest_weight is not null and latest_weight <= requirement.comparison_value::numeric
      when 'document' then false
      else false end;
    if not satisfied then
      if requirement.enforcement='block' then failures := failures || jsonb_build_array(jsonb_build_object('key',requirement.requirement_key,'message',requirement.customer_message));
      else reviews := reviews || jsonb_build_array(jsonb_build_object('key',requirement.requirement_key,'message',requirement.customer_message,'level',requirement.enforcement)); end if;
    end if;
  end loop;
  return query select jsonb_array_length(failures)=0, jsonb_array_length(reviews)>0, failures || reviews;
end; $$;

create or replace function app.capacity_available(
  target_business_id uuid, target_pool_id uuid, requested_start timestamptz, requested_end timestamptz
) returns integer language plpgsql security definer set search_path='' as $$
declare configured integer; location uuid; effective integer; used integer;
begin
  if not app.member_has_permission(target_business_id,'capacity.view') then raise exception 'capacity unavailable' using errcode='42501'; end if;
  select configured_capacity,location_id into configured,location from public.capacity_pools where business_id=target_business_id and id=target_pool_id and status='active' and app.member_can_access_location(business_id,location_id);
  if configured is null or requested_end<=requested_start then return 0; end if;
  if exists(select 1 from public.location_closures where business_id=target_business_id and location_id=location and closure_date between requested_start::date and (requested_end-interval '1 second')::date) then return 0; end if;
  select coalesce(min(capacity),configured) into effective from public.capacity_overrides where business_id=target_business_id and capacity_pool_id=target_pool_id and starts_on<=requested_start::date and ends_on>=(requested_end-interval '1 second')::date;
  select coalesce(sum(quantity),0) into used from (
    select quantity from public.capacity_holds where business_id=target_business_id and capacity_pool_id=target_pool_id and status='active' and expires_at>now() and starts_at<requested_end and ends_at>requested_start
    union all select quantity from public.capacity_commitments where business_id=target_business_id and capacity_pool_id=target_pool_id and status='active' and starts_at<requested_end and ends_at>requested_start
  ) usage;
  return greatest(effective-used,0);
end; $$;

create or replace function app.create_capacity_hold(
  target_business_id uuid, target_pool_id uuid, requested_start timestamptz, requested_end timestamptz,
  requested_quantity integer, hold_minutes integer, request_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid; created_id uuid; available integer;
begin
  if not app.member_has_permission(target_business_id,'bookings.create') then raise exception 'capacity hold unavailable' using errcode='42501'; end if;
  select id into existing_id from public.capacity_holds where business_id=target_business_id and idempotency_key=request_key;
  if existing_id is not null then return existing_id; end if;
  if requested_quantity<1 or hold_minutes not between 1 and 30 or requested_end<=requested_start then raise exception 'invalid capacity hold' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_pool_id::text,0));
  available := app.capacity_available(target_business_id,target_pool_id,requested_start,requested_end);
  if available<requested_quantity then raise exception 'capacity unavailable' using errcode='P0001'; end if;
  insert into public.capacity_holds(business_id,capacity_pool_id,starts_at,ends_at,quantity,expires_at,idempotency_key)
  values(target_business_id,target_pool_id,requested_start,requested_end,requested_quantity,now()+make_interval(mins=>hold_minutes),trim(request_key)) returning id into created_id;
  return created_id;
end; $$;

create or replace function app.release_capacity_hold(target_business_id uuid,target_hold_id uuid,reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.capacity_holds set status=case when expires_at<=now() then 'expired' else 'released' end,release_reason=nullif(trim(reason),'')
  where business_id=target_business_id and id=target_hold_id and status='active' and (held_by=auth.uid() or app.member_has_permission(target_business_id,'capacity.manage'));
  if not found then raise exception 'capacity hold unavailable' using errcode='P0002'; end if;
end; $$;

create or replace function app.convert_capacity_hold(target_business_id uuid,target_hold_id uuid,target_booking_item_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare held public.capacity_holds%rowtype; created_id uuid;
begin
  if not app.member_has_permission(target_business_id,'bookings.create') then raise exception 'capacity hold unavailable' using errcode='42501'; end if;
  select * into held from public.capacity_holds where business_id=target_business_id and id=target_hold_id for update;
  if held.id is null or held.status<>'active' or held.expires_at<=now() then raise exception 'capacity hold expired or unavailable' using errcode='P0001'; end if;
  insert into public.capacity_commitments(business_id,capacity_pool_id,hold_id,booking_item_id,starts_at,ends_at,quantity,capacity_snapshot)
  values(target_business_id,held.capacity_pool_id,held.id,target_booking_item_id,held.starts_at,held.ends_at,held.quantity,jsonb_build_object('hold_id',held.id,'quantity',held.quantity,'confirmed_at',now())) returning id into created_id;
  update public.capacity_holds set status='converted' where id=held.id; return created_id;
end; $$;

do $$ declare table_name text; begin foreach table_name in array array['service_booking_questions','service_requirements','capacity_pools','capacity_resources','capacity_overrides','capacity_holds','capacity_commitments'] loop
  execute format('alter table public.%I enable row level security',table_name); execute format('alter table public.%I force row level security',table_name);
end loop; end $$;
create policy questions_view on public.service_booking_questions for select to authenticated using(app.member_has_permission(business_id,'services.view'));
create policy requirements_view on public.service_requirements for select to authenticated using(app.member_has_permission(business_id,'services.view'));
create policy pools_view on public.capacity_pools for select to authenticated using(app.member_has_permission(business_id,'capacity.view') and app.member_can_access_location(business_id,location_id));
create policy resources_view on public.capacity_resources for select to authenticated using(app.member_has_permission(business_id,'capacity.view') and exists(select 1 from public.capacity_pools p where p.business_id=capacity_resources.business_id and p.id=capacity_resources.capacity_pool_id and app.member_can_access_location(p.business_id,p.location_id)));
create policy overrides_view on public.capacity_overrides for select to authenticated using(app.member_has_permission(business_id,'capacity.view') and exists(select 1 from public.capacity_pools p where p.business_id=capacity_overrides.business_id and p.id=capacity_overrides.capacity_pool_id and app.member_can_access_location(p.business_id,p.location_id)));
create policy holds_view on public.capacity_holds for select to authenticated using(held_by=auth.uid() or (app.member_has_permission(business_id,'capacity.view') and exists(select 1 from public.capacity_pools p where p.business_id=capacity_holds.business_id and p.id=capacity_holds.capacity_pool_id and app.member_can_access_location(p.business_id,p.location_id))));
create policy commitments_view on public.capacity_commitments for select to authenticated using(app.member_has_permission(business_id,'capacity.view') and exists(select 1 from public.capacity_pools p where p.business_id=capacity_commitments.business_id and p.id=capacity_commitments.capacity_pool_id and app.member_can_access_location(p.business_id,p.location_id)));
create policy questions_manage on public.service_booking_questions for all to authenticated using(app.member_has_permission(business_id,'services.manage')) with check(app.member_has_permission(business_id,'services.manage'));
create policy requirements_manage on public.service_requirements for all to authenticated using(app.member_has_permission(business_id,'services.manage')) with check(app.member_has_permission(business_id,'services.manage'));
create policy pools_manage on public.capacity_pools for all to authenticated using(app.member_has_permission(business_id,'capacity.manage')) with check(app.member_has_permission(business_id,'capacity.manage'));
create policy resources_manage on public.capacity_resources for all to authenticated using(app.member_has_permission(business_id,'capacity.manage')) with check(app.member_has_permission(business_id,'capacity.manage'));
create policy overrides_manage on public.capacity_overrides for all to authenticated using(app.member_has_permission(business_id,'capacity.manage')) with check(app.member_has_permission(business_id,'capacity.manage'));

revoke all on public.service_booking_questions,public.service_requirements,public.capacity_pools,public.capacity_resources,public.capacity_overrides,public.capacity_holds,public.capacity_commitments from anon,authenticated;
grant select on public.service_booking_questions,public.service_requirements,public.capacity_pools,public.capacity_resources,public.capacity_overrides,public.capacity_holds,public.capacity_commitments to authenticated;
revoke all on function app.add_service_requirement(uuid,uuid,text,text,text,text,text),app.add_service_booking_question(uuid,uuid,text,text,text,boolean,jsonb),app.configure_capacity_pool(uuid,uuid,uuid,text,text,integer,integer),app.save_capacity_override(uuid,uuid,date,date,integer,text),app.evaluate_pet_service_eligibility(uuid,uuid,uuid,date),app.capacity_available(uuid,uuid,timestamptz,timestamptz),app.create_capacity_hold(uuid,uuid,timestamptz,timestamptz,integer,integer,text),app.release_capacity_hold(uuid,uuid,text),app.convert_capacity_hold(uuid,uuid,uuid) from public;
grant execute on function app.add_service_requirement(uuid,uuid,text,text,text,text,text),app.add_service_booking_question(uuid,uuid,text,text,text,boolean,jsonb),app.configure_capacity_pool(uuid,uuid,uuid,text,text,integer,integer),app.save_capacity_override(uuid,uuid,date,date,integer,text),app.evaluate_pet_service_eligibility(uuid,uuid,uuid,date),app.capacity_available(uuid,uuid,timestamptz,timestamptz),app.create_capacity_hold(uuid,uuid,timestamptz,timestamptz,integer,integer,text),app.release_capacity_hold(uuid,uuid,text),app.convert_capacity_hold(uuid,uuid,uuid) to authenticated;
