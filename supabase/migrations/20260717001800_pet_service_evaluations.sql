-- PetCare E04 formal daycare and group-play evaluation lifecycle.

create table public.pet_service_evaluations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  pet_id uuid not null,
  evaluation_type text not null check (evaluation_type in ('daycare_group_play')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'conditional', 'suspended', 'failed', 'expired')),
  scheduled_for date,
  evaluated_at timestamptz,
  evaluated_by uuid references auth.users (id) on delete set null,
  expires_on date,
  conditions text,
  decision_notes text,
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, pet_id) references public.pets (business_id, id) on delete restrict,
  check (status <> 'conditional' or char_length(trim(coalesce(conditions, ''))) > 0),
  check (status = 'pending' or char_length(trim(coalesce(decision_notes, ''))) > 0),
  check (status not in ('approved', 'conditional') or expires_on is null or expires_on >= current_date)
);

create table public.pet_service_evaluation_transitions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  evaluation_id uuid not null,
  from_status text,
  to_status text not null check (to_status in ('pending', 'approved', 'conditional', 'suspended', 'failed', 'expired')),
  reason text not null check (char_length(trim(reason)) between 1 and 2000),
  actor_id uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, evaluation_id) references public.pet_service_evaluations (business_id, id) on delete restrict
);

create index pet_service_evaluations_pet_idx
on public.pet_service_evaluations (business_id, pet_id, evaluation_type, status, created_at desc);
create index pet_service_evaluation_transitions_idx
on public.pet_service_evaluation_transitions (business_id, evaluation_id, created_at);

create trigger pet_service_evaluations_set_updated_at before update on public.pet_service_evaluations
for each row execute function app.set_updated_at();
create trigger pet_service_evaluations_prevent_business_change before update on public.pet_service_evaluations
for each row execute function app.prevent_business_id_change();
create trigger pet_service_evaluation_transitions_prevent_business_change before update on public.pet_service_evaluation_transitions
for each row execute function app.prevent_business_id_change();
create trigger pet_service_evaluations_audit after insert or update or delete on public.pet_service_evaluations
for each row execute function app.audit_configuration_change('pet.service_evaluation.changed', 'pet_service_evaluation');

create or replace function app.create_pet_service_evaluation(
  target_business_id uuid,
  target_pet_id uuid,
  evaluation_kind text,
  scheduled_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'evaluation management unavailable' using errcode = '42501';
  end if;
  if evaluation_kind <> 'daycare_group_play'
    or (scheduled_date is not null and scheduled_date < current_date)
    or not exists (select 1 from public.pets where business_id = target_business_id and id = target_pet_id and status = 'active') then
    raise exception 'invalid service evaluation' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.pet_service_evaluations
    where business_id = target_business_id and pet_id = target_pet_id
      and evaluation_type = evaluation_kind and status = 'pending'
  ) then
    raise exception 'pending evaluation already exists' using errcode = '23505';
  end if;

  insert into public.pet_service_evaluations (
    business_id, pet_id, evaluation_type, scheduled_for
  ) values (target_business_id, target_pet_id, evaluation_kind, scheduled_date)
  returning id into created_id;
  insert into public.pet_service_evaluation_transitions (
    business_id, evaluation_id, from_status, to_status, reason
  ) values (target_business_id, created_id, null, 'pending', 'Evaluation requested');
  return created_id;
end;
$$;

create or replace function app.transition_pet_service_evaluation(
  target_business_id uuid,
  service_evaluation_id uuid,
  next_status text,
  transition_reason text,
  condition_text text,
  expiration_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_status text;
begin
  if not app.member_has_permission(target_business_id, 'pets.manage_care') then
    raise exception 'evaluation management unavailable' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(transition_reason, ''))) < 1
    or next_status not in ('approved', 'conditional', 'suspended', 'failed', 'expired')
    or (next_status = 'conditional' and char_length(trim(coalesce(condition_text, ''))) < 1)
    or (next_status in ('approved', 'conditional') and expiration_date is not null and expiration_date < current_date) then
    raise exception 'invalid evaluation transition' using errcode = '22023';
  end if;

  select status into current_status from public.pet_service_evaluations
  where business_id = target_business_id and id = service_evaluation_id for update;
  if not found then raise exception 'evaluation unavailable' using errcode = 'P0002'; end if;
  if not (
    (current_status = 'pending' and next_status in ('approved', 'conditional', 'failed'))
    or (current_status in ('approved', 'conditional') and next_status in ('suspended', 'expired'))
    or (current_status = 'suspended' and next_status in ('approved', 'conditional', 'failed', 'expired'))
  ) then
    raise exception 'evaluation transition unavailable' using errcode = '55000';
  end if;

  update public.pet_service_evaluations set
    status = next_status,
    evaluated_at = case when next_status in ('approved', 'conditional', 'failed') then now() else evaluated_at end,
    evaluated_by = case when next_status in ('approved', 'conditional', 'failed') then auth.uid() else evaluated_by end,
    expires_on = case when next_status in ('approved', 'conditional') then expiration_date else expires_on end,
    conditions = case when next_status = 'conditional' then trim(condition_text) else null end,
    decision_notes = trim(transition_reason)
  where business_id = target_business_id and id = service_evaluation_id;
  insert into public.pet_service_evaluation_transitions (
    business_id, evaluation_id, from_status, to_status, reason
  ) values (
    target_business_id, service_evaluation_id, current_status, next_status, trim(transition_reason)
  );
end;
$$;

alter table public.pet_service_evaluations enable row level security;
alter table public.pet_service_evaluations force row level security;
alter table public.pet_service_evaluation_transitions enable row level security;
alter table public.pet_service_evaluation_transitions force row level security;
create policy pet_service_evaluations_select on public.pet_service_evaluations for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));
create policy pet_service_evaluations_manage on public.pet_service_evaluations for all to authenticated
using (app.member_has_permission(business_id, 'pets.manage_care'))
with check (app.member_has_permission(business_id, 'pets.manage_care'));
create policy pet_service_evaluation_transitions_select on public.pet_service_evaluation_transitions for select to authenticated
using (app.member_has_permission(business_id, 'pets.view'));

revoke all on public.pet_service_evaluations, public.pet_service_evaluation_transitions from anon, authenticated;
grant select on public.pet_service_evaluations, public.pet_service_evaluation_transitions to authenticated;
revoke all on function app.create_pet_service_evaluation(uuid, uuid, text, date) from public;
grant execute on function app.create_pet_service_evaluation(uuid, uuid, text, date) to authenticated;
revoke all on function app.transition_pet_service_evaluation(uuid, uuid, text, text, text, date) from public;
grant execute on function app.transition_pet_service_evaluation(uuid, uuid, text, text, text, date) to authenticated;
