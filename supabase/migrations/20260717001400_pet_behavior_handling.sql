-- PetCare E04 structured behavior and handling safety records.

create table public.pet_behavior_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  behavior_type text not null check (behavior_type in (
    'aggression', 'bite_history', 'escape_risk', 'severe_anxiety', 'resource_guarding',
    'dog_interaction', 'human_interaction', 'handling_sensitivity', 'barrier_reactivity', 'other'
  )),
  severity text not null check (severity in ('information', 'caution', 'high', 'critical')),
  context_description text not null check (char_length(trim(context_description)) between 1 and 1000),
  observed_on date,
  triggers text,
  preferred_handling text not null check (char_length(trim(preferred_handling)) between 1 and 1000),
  prohibited_approaches text,
  calming_strategies text,
  group_play_guidance text not null check (group_play_guidance in ('not_evaluated', 'approved', 'conditional', 'not_approved')),
  information_source text not null check (information_source in ('customer_reported', 'staff_observed', 'veterinary_documented')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  resolved_reason text,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (observed_on is null or observed_on <= current_date),
  check ((resolved_at is null) = (resolved_by is null)),
  check (status <> 'resolved' or char_length(trim(coalesce(resolved_reason, ''))) > 0)
);

create index pet_behavior_records_active_idx
on public.pet_behavior_records (business_id, pet_id, severity, behavior_type)
where status = 'active';

create trigger pet_behavior_records_set_updated_at before update on public.pet_behavior_records
for each row execute function app.set_updated_at();
create trigger pet_behavior_records_prevent_business_change before update on public.pet_behavior_records
for each row execute function app.prevent_business_id_change();
create trigger pet_behavior_records_audit after insert or update or delete on public.pet_behavior_records
for each row execute function app.audit_configuration_change('pet.behavior_record.changed', 'pet_behavior_record');

create or replace function app.add_pet_behavior_record(
  target_business_id uuid,
  target_pet_id uuid,
  record_type text,
  risk_severity text,
  context_text text,
  observation_date date,
  trigger_text text,
  handling_text text,
  prohibited_text text,
  calming_text text,
  play_guidance text,
  source_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'behavior management unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if record_type not in (
      'aggression', 'bite_history', 'escape_risk', 'severe_anxiety', 'resource_guarding',
      'dog_interaction', 'human_interaction', 'handling_sensitivity', 'barrier_reactivity', 'other'
    )
    or risk_severity not in ('information', 'caution', 'high', 'critical')
    or char_length(trim(coalesce(context_text, ''))) < 1
    or (observation_date is not null and observation_date > current_date)
    or char_length(trim(coalesce(handling_text, ''))) < 1
    or play_guidance not in ('not_evaluated', 'approved', 'conditional', 'not_approved')
    or source_type not in ('customer_reported', 'staff_observed', 'veterinary_documented') then
    raise exception 'invalid behavior record' using errcode = '22023';
  end if;

  insert into public.pet_behavior_records (
    business_id, pet_id, behavior_type, severity, context_description, observed_on,
    triggers, preferred_handling, prohibited_approaches, calming_strategies,
    group_play_guidance, information_source
  ) values (
    target_business_id, target_pet_id, record_type, risk_severity, trim(context_text), observation_date,
    nullif(trim(trigger_text), ''), trim(handling_text), nullif(trim(prohibited_text), ''),
    nullif(trim(calming_text), ''), play_guidance, source_type
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function app.resolve_pet_behavior_record(
  target_business_id uuid,
  behavior_record_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'behavior management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 1 then
    raise exception 'resolution reason required' using errcode = '22023';
  end if;
  update public.pet_behavior_records set
    status = 'resolved', resolved_reason = trim(reason),
    resolved_by = auth.uid(), resolved_at = now()
  where business_id = target_business_id and id = behavior_record_id and status = 'active';
  if not found then raise exception 'behavior record unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_behavior_records enable row level security;
alter table public.pet_behavior_records force row level security;
create policy pet_behavior_records_select on public.pet_behavior_records for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_behavior_records_manage on public.pet_behavior_records for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_behavior_records from anon, authenticated;
grant select on public.pet_behavior_records to authenticated;
revoke all on function app.add_pet_behavior_record(uuid, uuid, text, text, text, date, text, text, text, text, text, text) from public;
grant execute on function app.add_pet_behavior_record(uuid, uuid, text, text, text, date, text, text, text, text, text, text) to authenticated;
revoke all on function app.resolve_pet_behavior_record(uuid, uuid, text) from public;
grant execute on function app.resolve_pet_behavior_record(uuid, uuid, text) to authenticated;
