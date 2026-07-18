-- PetCare E05 versioned service catalog foundation.

insert into public.permission_definitions (permission_key, description, risk_level) values
  ('services.view', 'View the tenant service catalog.', 'standard'),
  ('services.manage', 'Create, publish, pause, and retire service definitions.', 'sensitive');

insert into public.role_permissions (role_key, permission_key) values
  ('owner', 'services.view'), ('owner', 'services.manage'),
  ('manager', 'services.view'), ('manager', 'services.manage'),
  ('front_desk', 'services.view'),
  ('groomer', 'services.view'),
  ('marketing_editor', 'services.view');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  category text not null check (category in ('boarding', 'daycare', 'grooming', 'assessment', 'add_on')),
  internal_name text not null check (char_length(trim(internal_name)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'retired', 'archived')),
  display_order integer not null default 0 check (display_order >= 0),
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create unique index services_business_name_active_idx
on public.services (business_id, lower(trim(internal_name)))
where status <> 'archived';
create index services_business_catalog_idx
on public.services (business_id, status, display_order, internal_name);

create table public.service_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  service_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded', 'retired', 'archived')),
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  short_description text check (char_length(trim(short_description)) <= 240),
  full_description text check (char_length(trim(full_description)) <= 4000),
  internal_instructions text check (char_length(trim(internal_instructions)) <= 4000),
  time_model text not null check (time_model in ('overnight_date_range', 'attendance_day', 'fixed_appointment', 'flexible_appointment', 'add_on')),
  default_duration_minutes integer check (default_duration_minutes between 5 and 1440),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 720),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 720),
  confirmation_mode text not null default 'instant' check (confirmation_mode in ('instant', 'staff_approval', 'request_only')),
  multiple_pets_allowed boolean not null default true,
  separate_item_per_pet boolean not null default true,
  recurring_allowed boolean not null default false,
  effective_from timestamptz,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, service_id, version_number),
  foreign key (business_id, service_id) references public.services (business_id, id) on delete restrict,
  check ((status in ('published', 'superseded', 'retired')) = (published_at is not null and published_by is not null)),
  check (time_model not in ('fixed_appointment', 'flexible_appointment') or default_duration_minutes is not null)
);

create unique index service_versions_one_published_idx
on public.service_versions (business_id, service_id)
where status = 'published';
create index service_versions_history_idx
on public.service_versions (business_id, service_id, version_number desc);

create table public.service_location_enablements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  service_id uuid not null,
  location_id uuid not null,
  enabled boolean not null default true,
  public_website boolean not null default false,
  customer_portal boolean not null default true,
  staff_entry boolean not null default true,
  api_access boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, service_id, location_id),
  foreign key (business_id, service_id) references public.services (business_id, id) on delete restrict,
  foreign key (business_id, location_id) references public.locations (business_id, id) on delete restrict,
  check (not enabled or public_website or customer_portal or staff_entry or api_access)
);

create or replace function app.prevent_published_service_version_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' and new.status = 'superseded'
    and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception 'published service versions are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger services_set_updated_at before update on public.services
for each row execute function app.set_updated_at();
create trigger services_prevent_business_change before update on public.services
for each row execute function app.prevent_business_id_change();
create trigger service_versions_prevent_business_change before update on public.service_versions
for each row execute function app.prevent_business_id_change();
create trigger service_versions_immutable before update or delete on public.service_versions
for each row execute function app.prevent_published_service_version_change();
create trigger service_location_enablements_set_updated_at before update on public.service_location_enablements
for each row execute function app.set_updated_at();
create trigger service_location_enablements_prevent_business_change before update on public.service_location_enablements
for each row execute function app.prevent_business_id_change();
create trigger services_audit after insert or update or delete on public.services
for each row execute function app.audit_configuration_change('service.catalog_changed', 'service');
create trigger service_versions_audit after insert or update or delete on public.service_versions
for each row execute function app.audit_configuration_change('service.version_changed', 'service_version');
create trigger service_locations_audit after insert or update or delete on public.service_location_enablements
for each row execute function app.audit_configuration_change('service.location_changed', 'service_location_enablement');

create or replace function app.create_service_draft(
  target_business_id uuid, category_value text, internal_name_value text,
  customer_name_value text, time_model_value text, duration_minutes integer,
  confirmation_mode_value text, short_description_value text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare created_service_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'services.manage') then
    raise exception 'service management unavailable' using errcode = '42501';
  end if;
  insert into public.services (business_id, category, internal_name)
  values (target_business_id, category_value, trim(internal_name_value))
  returning id into created_service_id;
  insert into public.service_versions (
    business_id, service_id, version_number, customer_name, short_description,
    time_model, default_duration_minutes, confirmation_mode
  ) values (
    target_business_id, created_service_id, 1, trim(customer_name_value),
    nullif(trim(short_description_value), ''), time_model_value, duration_minutes, confirmation_mode_value
  );
  return created_service_id;
end;
$$;

create or replace function app.publish_service_version(
  target_business_id uuid, target_service_id uuid, target_version_id uuid,
  target_location_id uuid, website_channel boolean, portal_channel boolean,
  staff_channel boolean, api_channel boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.member_has_permission(target_business_id, 'services.manage') then
    raise exception 'service management unavailable' using errcode = '42501';
  end if;
  perform 1 from public.services where business_id = target_business_id and id = target_service_id for update;
  if not found then raise exception 'service unavailable' using errcode = 'P0002'; end if;
  update public.service_versions set
    status = 'superseded'
  where business_id = target_business_id and service_id = target_service_id and status = 'published';
  update public.service_versions set
    status = 'published', effective_from = coalesce(effective_from, now()),
    published_at = now(), published_by = auth.uid()
  where business_id = target_business_id and service_id = target_service_id
    and id = target_version_id and status = 'draft';
  if not found then raise exception 'draft service version unavailable' using errcode = 'P0002'; end if;
  update public.services set status = 'active' where business_id = target_business_id and id = target_service_id;
  insert into public.service_location_enablements (
    business_id, service_id, location_id, enabled, public_website, customer_portal, staff_entry, api_access
  ) values (
    target_business_id, target_service_id, target_location_id, true,
    website_channel, portal_channel, staff_channel, api_channel
  ) on conflict (business_id, service_id, location_id) do update set
    enabled = true, public_website = excluded.public_website,
    customer_portal = excluded.customer_portal, staff_entry = excluded.staff_entry,
    api_access = excluded.api_access;
end;
$$;

create or replace function app.set_service_status(
  target_business_id uuid, target_service_id uuid, new_status text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.member_has_permission(target_business_id, 'services.manage') then
    raise exception 'service management unavailable' using errcode = '42501';
  end if;
  if new_status not in ('active', 'paused', 'retired') then
    raise exception 'invalid service status' using errcode = '22023';
  end if;
  if new_status = 'active' and not exists (
    select 1 from public.service_versions where business_id = target_business_id
      and service_id = target_service_id and status = 'published'
  ) then raise exception 'service requires a published version' using errcode = '23514'; end if;
  update public.services set status = new_status
  where business_id = target_business_id and id = target_service_id and status <> 'archived';
  if not found then raise exception 'service unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.services enable row level security;
alter table public.services force row level security;
alter table public.service_versions enable row level security;
alter table public.service_versions force row level security;
alter table public.service_location_enablements enable row level security;
alter table public.service_location_enablements force row level security;

create policy services_select on public.services for select to authenticated
using (app.member_has_permission(business_id, 'services.view'));
create policy services_manage on public.services for all to authenticated
using (app.member_has_permission(business_id, 'services.manage'))
with check (app.member_has_permission(business_id, 'services.manage'));
create policy service_versions_select on public.service_versions for select to authenticated
using (app.member_has_permission(business_id, 'services.view'));
create policy service_versions_manage on public.service_versions for all to authenticated
using (app.member_has_permission(business_id, 'services.manage'))
with check (app.member_has_permission(business_id, 'services.manage'));
create policy service_locations_select on public.service_location_enablements for select to authenticated
using (app.member_has_permission(business_id, 'services.view'));
create policy service_locations_manage on public.service_location_enablements for all to authenticated
using (app.member_has_permission(business_id, 'services.manage'))
with check (app.member_has_permission(business_id, 'services.manage'));

revoke all on public.services, public.service_versions, public.service_location_enablements from anon, authenticated;
grant select on public.services, public.service_versions, public.service_location_enablements to authenticated;
revoke all on function app.create_service_draft(uuid, text, text, text, text, integer, text, text) from public;
revoke all on function app.publish_service_version(uuid, uuid, uuid, uuid, boolean, boolean, boolean, boolean) from public;
revoke all on function app.set_service_status(uuid, uuid, text) from public;
grant execute on function app.create_service_draft(uuid, text, text, text, text, integer, text, text) to authenticated;
grant execute on function app.publish_service_version(uuid, uuid, uuid, uuid, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function app.set_service_status(uuid, uuid, text) to authenticated;
