-- PetCare E03 dated location closures.

create table public.location_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  location_id uuid not null,
  closure_date date not null,
  reason text not null check (char_length(trim(reason)) between 2 and 200),
  customer_message text check (
    customer_message is null or char_length(trim(customer_message)) between 2 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, location_id, closure_date),
  foreign key (business_id, location_id)
    references public.locations (business_id, id) on delete cascade
);

create index location_closures_upcoming_idx
  on public.location_closures (business_id, location_id, closure_date);

create trigger location_closures_set_updated_at
before update on public.location_closures
for each row execute function app.set_updated_at();

create trigger location_closures_prevent_business_change
before update on public.location_closures
for each row execute function app.prevent_business_id_change();

create trigger location_closures_audit
after insert or update or delete on public.location_closures
for each row execute function app.audit_configuration_change(
  'location.closure_changed',
  'location_closure'
);

create or replace function app.save_location_closure(
  target_business_id uuid,
  target_location_id uuid,
  target_closure_date date,
  target_reason text,
  target_customer_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_closure_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'business.manage_locations')
    or not app.member_can_access_location(target_business_id, target_location_id) then
    raise exception 'closure unavailable' using errcode = '42501';
  end if;

  if target_closure_date is null or target_closure_date < current_date
    or char_length(trim(coalesce(target_reason, ''))) < 2
    or char_length(trim(target_reason)) > 200
    or char_length(trim(coalesce(target_customer_message, ''))) > 500 then
    raise exception 'invalid closure' using errcode = '22023';
  end if;

  insert into public.location_closures (
    business_id, location_id, closure_date, reason, customer_message
  ) values (
    target_business_id,
    target_location_id,
    target_closure_date,
    trim(target_reason),
    nullif(trim(target_customer_message), '')
  )
  on conflict (business_id, location_id, closure_date) do update
  set reason = excluded.reason,
      customer_message = excluded.customer_message
  returning id into saved_closure_id;

  return saved_closure_id;
end;
$$;

create or replace function app.delete_location_closure(
  target_business_id uuid,
  target_closure_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'business.manage_locations') then
    raise exception 'closure unavailable' using errcode = '42501';
  end if;

  delete from public.location_closures closure
  where closure.business_id = target_business_id
    and closure.id = target_closure_id
    and app.member_can_access_location(closure.business_id, closure.location_id);

  if not found then
    raise exception 'closure unavailable' using errcode = 'P0002';
  end if;
end;
$$;

alter table public.location_closures enable row level security;
alter table public.location_closures force row level security;

create policy location_closures_select_scoped_member
on public.location_closures for select to authenticated
using (app.member_can_access_location(business_id, location_id));

create policy location_closures_insert_manager
on public.location_closures for insert to authenticated
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

create policy location_closures_update_manager
on public.location_closures for update to authenticated
using (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
)
with check (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

create policy location_closures_delete_manager
on public.location_closures for delete to authenticated
using (
  app.member_has_permission(business_id, 'business.manage_locations')
  and app.member_can_access_location(business_id, location_id)
);

revoke all on public.location_closures from anon, authenticated;
grant select, insert, update, delete on public.location_closures to authenticated;

revoke all on function app.save_location_closure(uuid, uuid, date, text, text) from public;
revoke all on function app.delete_location_closure(uuid, uuid) from public;
grant execute on function app.save_location_closure(uuid, uuid, date, text, text) to authenticated;
grant execute on function app.delete_location_closure(uuid, uuid) to authenticated;
