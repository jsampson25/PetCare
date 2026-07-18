-- PetCare E04 structured pet identifiers and safe retirement.

create table public.pet_identifiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  identifier_type text not null check (identifier_type in ('microchip', 'license', 'registration', 'other')),
  identifier_value text not null check (char_length(trim(identifier_value)) between 1 and 200),
  normalized_value text generated always as (lower(regexp_replace(identifier_value, '[^a-zA-Z0-9]', '', 'g'))) stored,
  issuer text,
  issued_on date,
  expires_on date,
  status text not null default 'active' check (status in ('active', 'retired')),
  retired_reason text,
  retired_by uuid references auth.users (id) on delete set null,
  retired_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (char_length(normalized_value) > 0),
  check (issued_on is null or issued_on <= current_date),
  check (expires_on is null or issued_on is null or expires_on >= issued_on),
  check ((retired_at is null) = (retired_by is null)),
  check (status <> 'retired' or char_length(trim(coalesce(retired_reason, ''))) > 0)
);

create unique index pet_identifiers_active_value_idx
on public.pet_identifiers (business_id, identifier_type, normalized_value)
where status = 'active';
create index pet_identifiers_pet_idx
on public.pet_identifiers (business_id, pet_id, status, identifier_type);

create trigger pet_identifiers_set_updated_at before update on public.pet_identifiers
for each row execute function app.set_updated_at();
create trigger pet_identifiers_prevent_business_change before update on public.pet_identifiers
for each row execute function app.prevent_business_id_change();
create trigger pet_identifiers_audit after insert or update or delete on public.pet_identifiers
for each row execute function app.audit_configuration_change('pet.identifier.changed', 'pet_identifier');

create or replace function app.add_pet_identifier(
  target_business_id uuid,
  target_pet_id uuid,
  identifier_kind text,
  identifier_text text,
  issuer_name text,
  issue_date date,
  expiration_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'identifier management unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if identifier_kind not in ('microchip', 'license', 'registration', 'other')
    or char_length(trim(coalesce(identifier_text, ''))) < 1
    or char_length(regexp_replace(identifier_text, '[^a-zA-Z0-9]', '', 'g')) < 1
    or (issue_date is not null and issue_date > current_date)
    or (expiration_date is not null and issue_date is not null and expiration_date < issue_date) then
    raise exception 'invalid pet identifier' using errcode = '22023';
  end if;

  insert into public.pet_identifiers (
    business_id, pet_id, identifier_type, identifier_value, issuer, issued_on, expires_on
  ) values (
    target_business_id, target_pet_id, identifier_kind, trim(identifier_text),
    nullif(trim(issuer_name), ''), issue_date, expiration_date
  ) returning id into created_id;
  return created_id;
exception when unique_violation then
  raise exception 'identifier already assigned' using errcode = '23505';
end;
$$;

create or replace function app.retire_pet_identifier(
  target_business_id uuid,
  pet_identifier_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'identifier management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 1 then
    raise exception 'retirement reason required' using errcode = '22023';
  end if;
  update public.pet_identifiers set
    status = 'retired', retired_reason = trim(reason),
    retired_by = auth.uid(), retired_at = now()
  where business_id = target_business_id and id = pet_identifier_id and status = 'active';
  if not found then raise exception 'identifier unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_identifiers enable row level security;
alter table public.pet_identifiers force row level security;
create policy pet_identifiers_select on public.pet_identifiers for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_identifiers_manage on public.pet_identifiers for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_identifiers from anon, authenticated;
grant select on public.pet_identifiers to authenticated;
revoke all on function app.add_pet_identifier(uuid, uuid, text, text, text, date, date) from public;
grant execute on function app.add_pet_identifier(uuid, uuid, text, text, text, date, date) to authenticated;
revoke all on function app.retire_pet_identifier(uuid, uuid, text) from public;
grant execute on function app.retire_pet_identifier(uuid, uuid, text) to authenticated;
