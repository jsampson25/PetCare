-- PetCare E13 booking activity drill-down and audited export.
alter table public.reporting_runs drop constraint reporting_runs_report_key_check;
alter table public.reporting_runs add constraint reporting_runs_report_key_check check(report_key in('business_summary','booking_activity'));
create table public.report_exports(
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete restrict,reporting_run_id uuid not null references public.reporting_runs(id) on delete restrict,
 report_key text not null check(report_key in('booking_activity')),format text not null check(format in('csv')),row_count integer not null check(row_count>=0),definition_version integer not null check(definition_version>0),
 requested_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now()
);
create index report_exports_tenant_history_idx on public.report_exports(business_id,created_at desc);
create trigger report_exports_immutable before update or delete on public.report_exports for each row execute function app.prevent_commercial_snapshot_change();
create or replace function app.get_booking_activity_report(target_business_id uuid,period_start_value timestamptz,period_end_value timestamptz,export_value boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare generated_at_value timestamptz:=clock_timestamp();run_id_value uuid;rows_value jsonb;row_count_value integer;
begin
 if not app.member_has_permission(target_business_id,'reports.view_operational') then raise exception 'booking activity report unavailable' using errcode='42501';end if;
 if export_value and not app.member_has_permission(target_business_id,'reports.export') then raise exception 'report export unavailable' using errcode='42501';end if;
 if period_start_value is null or period_end_value is null or period_end_value<=period_start_value or period_end_value-period_start_value>interval '366 days' then raise exception 'valid report period required' using errcode='22023';end if;
 select coalesce(jsonb_agg(row_value order by row_value->>'starts_at',row_value->>'booking_number'),'[]'::jsonb) into rows_value from(
  select jsonb_build_object('booking_number',b.booking_number,'booking_status',b.status,'source_channel',b.source_channel,'customer_name',trim(c.first_name||' '||c.last_name),'pet_name',p.name,'service_name',sv.customer_name,'starts_at',bi.starts_at,'ends_at',bi.ends_at,'item_status',bi.status) row_value
  from public.booking_items bi join public.bookings b on b.business_id=bi.business_id and b.id=bi.booking_id join public.customers c on c.business_id=b.business_id and c.id=b.customer_id join public.pets p on p.business_id=bi.business_id and p.id=bi.pet_id join public.service_versions sv on sv.business_id=bi.business_id and sv.id=bi.service_version_id
  where bi.business_id=target_business_id and bi.starts_at>=period_start_value and bi.starts_at<period_end_value and app.member_can_access_location(b.business_id,b.location_id) order by bi.starts_at,b.booking_number limit 5000
 ) rows;
 row_count_value:=jsonb_array_length(rows_value);
 insert into public.reporting_runs(business_id,report_key,definition_version,period_start,period_end,time_basis,freshness_at,filters) values(target_business_id,'booking_activity',1,period_start_value,period_end_value,'UTC',generated_at_value,jsonb_build_object('location_scope','authorized','row_limit',5000,'export',export_value)) returning id into run_id_value;
 if export_value then insert into public.report_exports(business_id,reporting_run_id,report_key,format,row_count,definition_version) values(target_business_id,run_id_value,'booking_activity','csv',row_count_value,1);end if;
 return jsonb_build_object('run_id',run_id_value,'definition_version',1,'period',jsonb_build_object('start',period_start_value,'end',period_end_value,'time_basis','UTC'),'freshness',jsonb_build_object('status','current','as_of',generated_at_value),'row_count',row_count_value,'truncated',row_count_value=5000,'rows',rows_value);
end;$$;
alter table public.report_exports enable row level security;alter table public.report_exports force row level security;
revoke all on public.report_exports from anon,authenticated;grant select on public.report_exports to authenticated;
create policy report_exports_view on public.report_exports for select to authenticated using(app.member_has_permission(business_id,'reports.export'));
revoke all on function app.get_booking_activity_report(uuid,timestamptz,timestamptz,boolean) from public;grant execute on function app.get_booking_activity_report(uuid,timestamptz,timestamptz,boolean) to authenticated;
