-- PetCare E03 customer arrival and pickup windows.

create table public.location_customer_windows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  location_id uuid not null,
  window_type text not null check (window_type in ('arrival', 'pickup')),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  starts_at time,
  ends_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, location_id, window_type, day_of_week),
  foreign key (business_id, location_id)
    references public.locations (business_id, id) on delete cascade,
  check (
    (is_closed and starts_at is null and ends_at is null)
    or (not is_closed and starts_at is not null and ends_at is not null and starts_at < ends_at)
  )
);

create index location_customer_windows_location_idx
  on public.location_customer_windows (business_id, location_id, window_type, day_of_week);

create trigger location_customer_windows_set_updated_at
before update on public.location_customer_windows
for each row execute function app.set_updated_at();

create trigger location_customer_windows_prevent_business_change
before update on public.location_customer_windows
for each row execute function app.prevent_business_id_change();

create trigger location_customer_windows_audit
after insert or update or delete on public.location_customer_windows
for each row execute function app.audit_configuration_change(
  'location.customer_windows_changed',
  'location_customer_window'
);

create or replace function app.save_location_customer_windows(
  target_business_id uuid,
  target_location_id uuid,
  target_arrival_start time,
  target_arrival_end time,
  target_pickup_start time,
  target_pickup_end time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'business.manage_locations')
    or not app.member_can_access_location(target_business_id, target_location_id) then
    raise exception 'customer windows unavailable' using errcode = '42501';
  end if;

  if target_arrival_start is null or target_arrival_end is null
    or target_pickup_start is null or target_pickup_end is null
    or target_arrival_start >= target_arrival_end
    or target_pickup_start >= target_pickup_end then
    raise exception 'invalid customer windows' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.location_operating_hours hours
    where hours.business_id = target_business_id
      and hours.location_id = target_location_id
      and hours.day_of_week between 1 and 5
      and (
        hours.is_closed
        or target_arrival_start < hours.opens_at
        or target_arrival_end > hours.closes_at
        or target_pickup_start < hours.opens_at
        or target_pickup_end > hours.closes_at
      )
  ) then
    raise exception 'customer windows must fit operating hours' using errcode = '22023';
  end if;

  insert into public.location_customer_windows (
    business_id, location_id, window_type, day_of_week, is_closed, starts_at, ends_at
  )
  select
    target_business_id,
    target_location_id,
    window_kind,
    day_number,
    day_number in (0, 6),
    case
      when day_number in (0, 6) then null
      when window_kind = 'arrival' then target_arrival_start
      else target_pickup_start
    end,
    case
      when day_number in (0, 6) then null
      when window_kind = 'arrival' then target_arrival_end
      else target_pickup_end
    end
  from generate_series(0, 6) day_number
  cross join (values ('arrival'), ('pickup')) as window_types(window_kind)
  on conflict (business_id, location_id, window_type, day_of_week) do update
  set is_closed = excluded.is_closed,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at;
end;
$$;

alter table public.location_customer_windows enable row level security;
alter table public.location_customer_windows force row level security;

create policy location_customer_windows_select_scoped_member
on public.location_customer_windows for select to authenticated
using (app.member_can_access_location(business_id, location_id));

create policy location_customer_windows_insert_manager
on public.location_customer_windows for insert to authenticated
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

create policy location_customer_windows_update_manager
on public.location_customer_windows for update to authenticated
using (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
)
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

create policy location_customer_windows_delete_manager
on public.location_customer_windows for delete to authenticated
using (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

revoke all on public.location_customer_windows from anon, authenticated;
grant select, insert, update, delete on public.location_customer_windows to authenticated;

revoke all on function app.save_location_customer_windows(uuid, uuid, time, time, time, time) from public;
grant execute on function app.save_location_customer_windows(uuid, uuid, time, time, time, time) to authenticated;
