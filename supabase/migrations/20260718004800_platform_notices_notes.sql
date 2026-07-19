-- PetCare E14 tenant operational notices and retention-aware internal platform notes.
alter table public.platform_permission_definitions
  drop constraint platform_permission_definitions_permission_key_check;

alter table public.platform_permission_definitions
  add constraint platform_permission_definitions_permission_key_check
  check (
    permission_key in (
      'platform.businesses.read', 'platform.businesses.manage', 'platform.audit.read',
      'platform.subscriptions.read', 'platform.subscriptions.manage',
      'platform.features.read', 'platform.features.manage',
      'platform.support.read', 'platform.support.manage', 'platform.support.write',
      'platform.jobs.read', 'platform.jobs.manage',
      'platform.privacy.read', 'platform.privacy.manage',
      'platform.health.read', 'platform.health.manage',
      'platform.provisioning.read', 'platform.provisioning.manage',
      'platform.communications.read', 'platform.communications.manage',
      'platform.notes.read', 'platform.notes.manage'
    )
  );

insert into public.platform_permission_definitions (permission_key, description)
values
  ('platform.communications.read', 'View platform operational notices and acknowledgement status.'),
  ('platform.communications.manage', 'Create, publish, and end platform operational notices.'),
  ('platform.notes.read', 'View restricted internal tenant notes within retention policy.'),
  ('platform.notes.manage', 'Append restricted retention-aware internal tenant notes.');

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('platform_admin', 'platform.communications.read'),
  ('platform_admin', 'platform.communications.manage'),
  ('platform_admin', 'platform.notes.read'),
  ('platform_admin', 'platform.notes.manage'),
  ('platform_support', 'platform.communications.read'),
  ('platform_support', 'platform.communications.manage'),
  ('platform_support', 'platform.notes.read'),
  ('platform_support', 'platform.notes.manage'),
  ('platform_auditor', 'platform.communications.read'),
  ('platform_auditor', 'platform.notes.read');

create table public.platform_operational_notices (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('all_tenants', 'tenant')),
  business_id uuid references public.businesses(id) on delete restrict,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null check (char_length(trim(title)) between 5 and 120),
  message text not null check (char_length(trim(message)) between 12 and 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  acknowledgement_required boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'ended')),
  created_by uuid not null references public.identity_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  ended_at timestamptz,
  check ((audience = 'tenant') = (business_id is not null)),
  check (ends_at > starts_at),
  check ((status = 'draft' and published_at is null and ended_at is null)
    or (status = 'published' and published_at is not null and ended_at is null)
    or (status = 'ended' and published_at is not null and ended_at is not null))
);

create table public.platform_notice_acknowledgements (
  notice_id uuid not null references public.platform_operational_notices(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  identity_id uuid not null references public.identity_profiles(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  primary key (notice_id, business_id, identity_id)
);

create table public.platform_internal_tenant_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  category text not null check (category in ('support', 'billing', 'risk', 'privacy', 'operations')),
  note text not null check (char_length(trim(note)) between 12 and 2000),
  retention_until date not null,
  legal_hold boolean not null default false,
  created_by uuid not null references public.identity_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (retention_until >= created_at::date)
);

create table public.platform_communication_events (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid references public.platform_operational_notices(id) on delete restrict,
  note_id uuid references public.platform_internal_tenant_notes(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  event_type text not null check (event_type in ('notice_created', 'notice_published', 'notice_ended', 'notice_acknowledged', 'note_created')),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  actor_id uuid not null references public.identity_profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique,
  check ((notice_id is not null)::integer + (note_id is not null)::integer = 1)
);

create trigger platform_operational_notices_immutable
before delete on public.platform_operational_notices
for each row execute function app.prevent_commercial_snapshot_change();
create trigger platform_internal_tenant_notes_immutable
before update or delete on public.platform_internal_tenant_notes
for each row execute function app.prevent_commercial_snapshot_change();
create trigger platform_communication_events_immutable
before update or delete on public.platform_communication_events
for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.create_platform_operational_notice(
  audience_value text,
  target_business_id uuid,
  severity_value text,
  title_value text,
  message_value text,
  starts_at_value timestamptz,
  ends_at_value timestamptz,
  acknowledgement_required_value boolean,
  reason_value text,
  request_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare notice_id uuid;
begin
  if not app.platform_has_permission('platform.communications.manage') then
    raise exception 'platform notice management unavailable' using errcode = '42501';
  end if;
  select event.notice_id into notice_id from public.platform_communication_events event
  where event.idempotency_key = trim(request_key);
  if notice_id is not null then return notice_id; end if;
  if audience_value not in ('all_tenants', 'tenant')
    or ((audience_value = 'tenant') <> (target_business_id is not null))
    or (target_business_id is not null and not exists (select 1 from public.businesses where id = target_business_id))
    or severity_value not in ('info', 'warning', 'critical')
    or char_length(trim(coalesce(title_value, ''))) not between 5 and 120
    or char_length(trim(coalesce(message_value, ''))) not between 12 and 2000
    or ends_at_value <= starts_at_value
    or char_length(trim(coalesce(reason_value, ''))) < 12
    or char_length(trim(coalesce(request_key, ''))) < 8 then
    raise exception 'valid documented operational notice required' using errcode = '22023';
  end if;
  insert into public.platform_operational_notices (
    audience, business_id, severity, title, message, starts_at, ends_at,
    acknowledgement_required, created_by
  ) values (
    audience_value, target_business_id, severity_value, trim(title_value), trim(message_value),
    starts_at_value, ends_at_value, acknowledgement_required_value, auth.uid()
  ) returning id into notice_id;
  insert into public.platform_communication_events (
    notice_id, business_id, event_type, reason, actor_id, idempotency_key
  ) values (
    notice_id, target_business_id, 'notice_created', trim(reason_value), auth.uid(), trim(request_key)
  );
  return notice_id;
end;
$$;

create or replace function app.transition_platform_operational_notice(
  notice_id_value uuid,
  next_status_value text,
  reason_value text,
  request_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare notice public.platform_operational_notices%rowtype; event_id uuid;
begin
  if not app.platform_has_permission('platform.communications.manage') then
    raise exception 'platform notice management unavailable' using errcode = '42501';
  end if;
  select id into event_id from public.platform_communication_events where idempotency_key = trim(request_key);
  if event_id is not null then return event_id; end if;
  select * into notice from public.platform_operational_notices where id = notice_id_value for update;
  if notice.id is null or char_length(trim(coalesce(reason_value, ''))) < 12
    or (notice.status, next_status_value) not in (('draft', 'published'), ('published', 'ended')) then
    raise exception 'valid notice transition required' using errcode = 'P0001';
  end if;
  update public.platform_operational_notices set
    status = next_status_value,
    published_at = case when next_status_value = 'published' then now() else published_at end,
    ended_at = case when next_status_value = 'ended' then now() end
  where id = notice.id;
  insert into public.platform_communication_events (
    notice_id, business_id, event_type, reason, actor_id, idempotency_key
  ) values (
    notice.id, notice.business_id,
    case when next_status_value = 'published' then 'notice_published' else 'notice_ended' end,
    trim(reason_value), auth.uid(), trim(request_key)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.create_platform_internal_tenant_note(
  target_business_id uuid,
  category_value text,
  note_value text,
  retention_until_value date,
  legal_hold_value boolean,
  reason_value text,
  request_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare note_id uuid;
begin
  if not app.platform_has_permission('platform.notes.manage') then
    raise exception 'platform note management unavailable' using errcode = '42501';
  end if;
  select event.note_id into note_id from public.platform_communication_events event
  where event.idempotency_key = trim(request_key);
  if note_id is not null then return note_id; end if;
  if not exists (select 1 from public.businesses where id = target_business_id)
    or category_value not in ('support', 'billing', 'risk', 'privacy', 'operations')
    or char_length(trim(coalesce(note_value, ''))) not between 12 and 2000
    or retention_until_value < current_date
    or retention_until_value > current_date + 2557
    or char_length(trim(coalesce(reason_value, ''))) < 12
    or char_length(trim(coalesce(request_key, ''))) < 8 then
    raise exception 'valid retention-aware internal note required' using errcode = '22023';
  end if;
  insert into public.platform_internal_tenant_notes (
    business_id, category, note, retention_until, legal_hold, created_by
  ) values (
    target_business_id, category_value, trim(note_value), retention_until_value,
    legal_hold_value, auth.uid()
  ) returning id into note_id;
  insert into public.platform_communication_events (
    note_id, business_id, event_type, reason, actor_id, idempotency_key
  ) values (
    note_id, target_business_id, 'note_created', trim(reason_value), auth.uid(), trim(request_key)
  );
  return note_id;
end;
$$;

create or replace function app.list_platform_communications() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
begin
  if not app.platform_has_permission('platform.communications.read') then
    raise exception 'platform communications unavailable' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'notices', coalesce((select jsonb_agg(jsonb_build_object(
      'notice_id', n.id, 'audience', n.audience, 'business_id', n.business_id,
      'business_name', b.name, 'severity', n.severity, 'title', n.title,
      'message', n.message, 'starts_at', n.starts_at, 'ends_at', n.ends_at,
      'acknowledgement_required', n.acknowledgement_required, 'status', n.status,
      'acknowledgement_count', (select count(*) from public.platform_notice_acknowledgements a where a.notice_id = n.id)
    ) order by n.created_at desc) from public.platform_operational_notices n
      left join public.businesses b on b.id = n.business_id), '[]'::jsonb),
    'notes', case when app.platform_has_permission('platform.notes.read') then
      coalesce((select jsonb_agg(jsonb_build_object(
        'note_id', note.id, 'business_id', note.business_id, 'business_name', b.name,
        'category', note.category, 'note', note.note, 'retention_until', note.retention_until,
        'legal_hold', note.legal_hold, 'created_at', note.created_at
      ) order by note.created_at desc) from public.platform_internal_tenant_notes note
        join public.businesses b on b.id = note.business_id
        where note.legal_hold or note.retention_until >= current_date), '[]'::jsonb)
      else '[]'::jsonb end
  );
end;
$$;

create or replace function app.list_active_tenant_notices(target_business_id uuid) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
begin
  if not exists (select 1 from public.business_memberships m where m.business_id = target_business_id and m.identity_id = auth.uid() and m.state = 'active') then
    raise exception 'tenant notices unavailable' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'notice_id', n.id, 'severity', n.severity, 'title', n.title, 'message', n.message,
    'ends_at', n.ends_at, 'acknowledgement_required', n.acknowledgement_required,
    'acknowledged', exists (select 1 from public.platform_notice_acknowledgements a
      where a.notice_id = n.id and a.business_id = target_business_id and a.identity_id = auth.uid())
  ) order by n.severity desc, n.starts_at desc) from public.platform_operational_notices n
    where n.status = 'published' and now() between n.starts_at and n.ends_at
      and (n.audience = 'all_tenants' or n.business_id = target_business_id)), '[]'::jsonb);
end;
$$;

create or replace function app.acknowledge_platform_notice(target_business_id uuid, notice_id_value uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare acknowledgement_identity uuid;
begin
  if not exists (select 1 from public.business_memberships m where m.business_id = target_business_id and m.identity_id = auth.uid() and m.state = 'active')
    or not exists (select 1 from public.platform_operational_notices n where n.id = notice_id_value
      and n.status = 'published' and now() between n.starts_at and n.ends_at
      and (n.audience = 'all_tenants' or n.business_id = target_business_id)) then
    raise exception 'active tenant notice unavailable' using errcode = '42501';
  end if;
  insert into public.platform_notice_acknowledgements (notice_id, business_id, identity_id)
  values (notice_id_value, target_business_id, auth.uid()) on conflict do nothing
  returning identity_id into acknowledgement_identity;
  if acknowledgement_identity is null then acknowledgement_identity := auth.uid(); end if;
  insert into public.platform_communication_events (
    notice_id, business_id, event_type, reason, actor_id, idempotency_key
  ) values (
    notice_id_value, target_business_id, 'notice_acknowledged', 'Tenant member acknowledged notice.',
    auth.uid(), 'notice-ack:' || notice_id_value || ':' || target_business_id || ':' || auth.uid()
  ) on conflict (idempotency_key) do nothing;
  return acknowledgement_identity;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_operational_notices', 'platform_notice_acknowledgements',
    'platform_internal_tenant_notes', 'platform_communication_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on public.platform_operational_notices, public.platform_notice_acknowledgements,
  public.platform_internal_tenant_notes, public.platform_communication_events to authenticated;
create policy platform_notices_operator on public.platform_operational_notices for select to authenticated
using (app.platform_has_permission('platform.communications.read'));
create policy platform_notice_ack_operator on public.platform_notice_acknowledgements for select to authenticated
using (app.platform_has_permission('platform.communications.read'));
create policy platform_notes_operator on public.platform_internal_tenant_notes for select to authenticated
using (app.platform_has_permission('platform.notes.read'));
create policy platform_communication_events_operator on public.platform_communication_events for select to authenticated
using (app.platform_has_permission('platform.audit.read'));

revoke all on function app.create_platform_operational_notice(text, uuid, text, text, text, timestamptz, timestamptz, boolean, text, text),
  app.transition_platform_operational_notice(uuid, text, text, text),
  app.create_platform_internal_tenant_note(uuid, text, text, date, boolean, text, text),
  app.list_platform_communications(), app.list_active_tenant_notices(uuid),
  app.acknowledge_platform_notice(uuid, uuid) from public;
grant execute on function app.create_platform_operational_notice(text, uuid, text, text, text, timestamptz, timestamptz, boolean, text, text),
  app.transition_platform_operational_notice(uuid, text, text, text),
  app.create_platform_internal_tenant_note(uuid, text, text, date, boolean, text, text),
  app.list_platform_communications(), app.list_active_tenant_notices(uuid),
  app.acknowledge_platform_notice(uuid, uuid) to authenticated;
