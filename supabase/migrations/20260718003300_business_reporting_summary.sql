-- PetCare E13 canonical minimum business reporting with auditable runs.

insert into public.permission_definitions(permission_key,description,risk_level) values
  ('reports.view_summary','Open the tenant business reporting summary.','standard') on conflict do nothing;
insert into public.role_permissions(role_key,permission_key) values
  ('owner','reports.view_summary'),('manager','reports.view_summary'),('accountant','reports.view_summary'),('read_only_auditor','reports.view_summary') on conflict do nothing;

create table public.reporting_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  report_key text not null check (report_key in ('business_summary')),
  definition_version integer not null check (definition_version > 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  time_basis text not null check (time_basis in ('UTC')),
  freshness_at timestamptz not null,
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  requested_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index reporting_runs_tenant_history_idx on public.reporting_runs (business_id, created_at desc);
create trigger reporting_runs_immutable before update or delete on public.reporting_runs for each row execute function app.prevent_commercial_snapshot_change();

create or replace function app.get_business_summary_report(
  target_business_id uuid,
  period_start_value timestamptz,
  period_end_value timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_at_value timestamptz := clock_timestamp();
  run_id_value uuid;
  operational_allowed boolean;
  financial_allowed boolean;
  currency_value text;
  result_value jsonb;
begin
  operational_allowed := app.member_has_permission(target_business_id, 'reports.view_operational');
  financial_allowed := app.member_has_permission(target_business_id, 'reports.view_financial');
  if not operational_allowed and not financial_allowed then
    raise exception 'report unavailable' using errcode = '42501';
  end if;
  if period_start_value is null or period_end_value is null or period_end_value <= period_start_value or period_end_value - period_start_value > interval '366 days' then
    raise exception 'valid report period required' using errcode = '22023';
  end if;

  select min(i.currency_code) into currency_value
  from public.invoices i
  where i.business_id = target_business_id
    and app.member_can_access_location(i.business_id, i.location_id)
    and i.status <> 'void';
  currency_value := coalesce(currency_value, 'USD');

  insert into public.reporting_runs(business_id, report_key, definition_version, period_start, period_end, time_basis, freshness_at, filters)
  values(target_business_id, 'business_summary', 1, period_start_value, period_end_value, 'UTC', generated_at_value, jsonb_build_object('location_scope', 'authorized'))
  returning id into run_id_value;

  result_value := jsonb_build_object(
    'run_id', run_id_value,
    'definition_version', 1,
    'period', jsonb_build_object('start', period_start_value, 'end', period_end_value, 'time_basis', 'UTC'),
    'freshness', jsonb_build_object('status', 'current', 'as_of', generated_at_value),
    'currency_code', currency_value,
    'operational', case when operational_allowed then jsonb_build_object(
      'booking_requests', (select count(*) from public.bookings b where b.business_id = target_business_id and app.member_can_access_location(b.business_id, b.location_id) and b.created_at >= period_start_value and b.created_at < period_end_value),
      'confirmed_bookings', (select count(*) from public.bookings b where b.business_id = target_business_id and app.member_can_access_location(b.business_id, b.location_id) and b.status in ('confirmed','completed') and exists(select 1 from public.booking_items bi where bi.business_id=b.business_id and bi.booking_id=b.id and bi.starts_at >= period_start_value and bi.starts_at < period_end_value)),
      'cancelled_bookings', (select count(*) from public.bookings b where b.business_id = target_business_id and app.member_can_access_location(b.business_id, b.location_id) and b.status = 'cancelled' and b.updated_at >= period_start_value and b.updated_at < period_end_value),
      'completed_bookings', (select count(*) from public.bookings b where b.business_id = target_business_id and app.member_can_access_location(b.business_id, b.location_id) and b.status = 'completed' and b.updated_at >= period_start_value and b.updated_at < period_end_value),
      'pets_currently_in_care', (select count(*) from public.pet_visits pv join public.operational_visits ov on ov.business_id=pv.business_id and ov.id=pv.operational_visit_id where pv.business_id=target_business_id and pv.status='in_care' and app.member_can_access_location(ov.business_id,ov.location_id)),
      'open_operational_alerts', (select count(*) from public.operational_alerts oa join public.operational_visits ov on ov.business_id=oa.business_id and ov.id=oa.operational_visit_id where oa.business_id=target_business_id and oa.status in ('open','acknowledged') and app.member_can_access_location(ov.business_id,ov.location_id))
    ) else null end,
    'financial', case when financial_allowed then jsonb_build_object(
      'net_invoiced_minor', coalesce((select sum(iv.total_minor) from public.invoices i join public.invoice_versions iv on iv.business_id=i.business_id and iv.invoice_id=i.id and iv.version_number=i.current_version_number where i.business_id=target_business_id and i.status<>'void' and i.issued_at>=period_start_value and i.issued_at<period_end_value and app.member_can_access_location(i.business_id,i.location_id)),0),
      'collected_cash_minor', coalesce((select sum(p.amount_minor) from public.payments p where p.business_id=target_business_id and p.status='succeeded' and p.collected_at>=period_start_value and p.collected_at<period_end_value and app.member_can_access_location(p.business_id,p.location_id)),0),
      'refunded_cash_minor', coalesce((select sum(r.amount_minor) from public.refunds r join public.invoices i on i.business_id=r.business_id and i.id=r.invoice_id where r.business_id=target_business_id and r.refunded_at>=period_start_value and r.refunded_at<period_end_value and app.member_can_access_location(i.business_id,i.location_id)),0),
      'outstanding_balance_minor', coalesce((select sum(greatest(ib.balance_due_minor,0)) from public.invoice_balances ib join public.invoices i on i.business_id=ib.business_id and i.id=ib.invoice_id where ib.business_id=target_business_id and i.status not in('void','uncollectible') and app.member_can_access_location(i.business_id,i.location_id)),0)
    ) else null end
  );
  return result_value;
end;
$$;

alter table public.reporting_runs enable row level security;
alter table public.reporting_runs force row level security;
revoke all on public.reporting_runs from anon, authenticated;
grant select on public.reporting_runs to authenticated;
create policy reporting_runs_view on public.reporting_runs for select to authenticated using (
  app.member_has_permission(business_id, 'reports.view_operational') or app.member_has_permission(business_id, 'reports.view_financial')
);
revoke all on function app.get_business_summary_report(uuid,timestamptz,timestamptz) from public;
grant execute on function app.get_business_summary_report(uuid,timestamptz,timestamptz) to authenticated;
