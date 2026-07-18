-- PetCare E04 structured pet health conditions and medical alerts.

create table public.pet_health_conditions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  condition_name text not null check (char_length(trim(condition_name)) between 1 and 200),
  category text not null check (category in (
    'cardiac', 'respiratory', 'neurological', 'seizure', 'mobility', 'sensory',
    'digestive', 'endocrine', 'skin_coat', 'immune', 'post_surgical', 'other'
  )),
  severity text not null check (severity in ('mild', 'moderate', 'severe', 'critical')),
  diagnosed_on date,
  care_impact text not null check (char_length(trim(care_impact)) between 1 and 1000),
  emergency_instructions text,
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
  check (diagnosed_on is null or diagnosed_on <= current_date),
  check (severity not in ('severe', 'critical') or char_length(trim(coalesce(emergency_instructions, ''))) > 0),
  check ((resolved_at is null) = (resolved_by is null)),
  check (status <> 'resolved' or char_length(trim(coalesce(resolved_reason, ''))) > 0)
);

create index pet_health_conditions_active_idx
on public.pet_health_conditions (business_id, pet_id, severity, category)
where status = 'active';

create trigger pet_health_conditions_set_updated_at before update on public.pet_health_conditions
for each row execute function app.set_updated_at();
create trigger pet_health_conditions_prevent_business_change before update on public.pet_health_conditions
for each row execute function app.prevent_business_id_change();
create trigger pet_health_conditions_audit after insert or update or delete on public.pet_health_conditions
for each row execute function app.audit_configuration_change('pet.health_condition.changed', 'pet_health_condition');

create or replace function app.add_pet_health_condition(
  target_business_id uuid,
  target_pet_id uuid,
  health_condition_name text,
  condition_category text,
  condition_severity text,
  diagnosis_date date,
  care_impact_text text,
  emergency_instruction_text text,
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
    raise exception 'health management unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id) then
    raise exception 'pet unavailable' using errcode = 'P0002';
  end if;
  if char_length(trim(coalesce(health_condition_name, ''))) < 1
    or condition_category not in (
      'cardiac', 'respiratory', 'neurological', 'seizure', 'mobility', 'sensory',
      'digestive', 'endocrine', 'skin_coat', 'immune', 'post_surgical', 'other'
    )
    or condition_severity not in ('mild', 'moderate', 'severe', 'critical')
    or (diagnosis_date is not null and diagnosis_date > current_date)
    or char_length(trim(coalesce(care_impact_text, ''))) < 1
    or (condition_severity in ('severe', 'critical') and char_length(trim(coalesce(emergency_instruction_text, ''))) < 1)
    or source_type not in ('customer_reported', 'staff_observed', 'veterinary_documented') then
    raise exception 'invalid health condition' using errcode = '22023';
  end if;

  insert into public.pet_health_conditions (
    business_id, pet_id, condition_name, category, severity, diagnosed_on,
    care_impact, emergency_instructions, information_source
  ) values (
    target_business_id, target_pet_id, trim(health_condition_name), condition_category,
    condition_severity, diagnosis_date, trim(care_impact_text),
    nullif(trim(emergency_instruction_text), ''), source_type
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function app.resolve_pet_health_condition(
  target_business_id uuid,
  health_condition_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'health management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 1 then
    raise exception 'resolution reason required' using errcode = '22023';
  end if;
  update public.pet_health_conditions set
    status = 'resolved', resolved_reason = trim(reason),
    resolved_by = auth.uid(), resolved_at = now()
  where business_id = target_business_id and id = health_condition_id and status = 'active';
  if not found then raise exception 'health condition unavailable' using errcode = 'P0002'; end if;
end;
$$;

alter table public.pet_health_conditions enable row level security;
alter table public.pet_health_conditions force row level security;
create policy pet_health_conditions_select on public.pet_health_conditions for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_health_conditions_manage on public.pet_health_conditions for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));

revoke all on public.pet_health_conditions from anon, authenticated;
grant select on public.pet_health_conditions to authenticated;
revoke all on function app.add_pet_health_condition(uuid, uuid, text, text, text, date, text, text, text) from public;
grant execute on function app.add_pet_health_condition(uuid, uuid, text, text, text, date, text, text, text) to authenticated;
revoke all on function app.resolve_pet_health_condition(uuid, uuid, text) from public;
grant execute on function app.resolve_pet_health_condition(uuid, uuid, text) to authenticated;
