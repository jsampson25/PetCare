-- PetCare E13 completed-customer return and service-mix reporting.
alter table public.reporting_runs drop constraint reporting_runs_report_key_check;
alter table public.reporting_runs add constraint reporting_runs_report_key_check check(report_key in('business_summary','booking_activity','capacity_utilization','financial_reconciliation','care_compliance','customer_service_mix'));

create or replace function app.get_customer_service_mix_report(target_business_id uuid,period_start_value timestamptz,period_end_value timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare generated_at_value timestamptz:=clock_timestamp();run_id_value uuid;service_rows_value jsonb;summary_value jsonb;
begin
 if not app.member_has_permission(target_business_id,'reports.view_operational') then raise exception 'customer activity report unavailable' using errcode='42501';end if;
 if period_start_value is null or period_end_value is null or period_end_value<=period_start_value or period_end_value-period_start_value>interval '366 days' then raise exception 'valid report period required' using errcode='22023';end if;
 with completed_in_period as(
  select b.id,b.customer_id,b.updated_at from public.bookings b where b.business_id=target_business_id and b.status='completed' and b.updated_at>=period_start_value and b.updated_at<period_end_value and app.member_can_access_location(b.business_id,b.location_id)
 ),customer_cohort as(
  select cip.customer_id,count(*) period_completed_count,exists(select 1 from public.bookings prior where prior.business_id=target_business_id and prior.customer_id=cip.customer_id and prior.status='completed' and prior.updated_at<period_start_value and app.member_can_access_location(prior.business_id,prior.location_id)) had_prior_completed
  from completed_in_period cip group by cip.customer_id
 )
 select jsonb_build_object('completed_bookings',(select count(*) from completed_in_period),'customers_with_completed_booking',count(*),'first_time_completed_customers',count(*) filter(where not had_prior_completed),'returning_completed_customers',count(*) filter(where had_prior_completed),'repeat_customer_rate_percent',case when count(*)>0 then round(count(*) filter(where had_prior_completed)::numeric/count(*)*100,1) else 0 end) into summary_value from customer_cohort;
 with completed_items as(
  select s.category,sv.customer_name service_name,count(*) completed_items,count(distinct bi.booking_id) completed_bookings,count(distinct b.customer_id) distinct_customers
  from public.booking_items bi join public.bookings b on b.business_id=bi.business_id and b.id=bi.booking_id join public.service_versions sv on sv.business_id=bi.business_id and sv.id=bi.service_version_id join public.services s on s.business_id=sv.business_id and s.id=sv.service_id
  where bi.business_id=target_business_id and bi.status='completed' and b.status='completed' and b.updated_at>=period_start_value and b.updated_at<period_end_value and app.member_can_access_location(b.business_id,b.location_id)
  group by s.category,sv.customer_name
 ) select coalesce(jsonb_agg(jsonb_build_object('category',category,'service_name',service_name,'completed_items',completed_items,'completed_bookings',completed_bookings,'distinct_customers',distinct_customers) order by completed_items desc,category,service_name),'[]'::jsonb) into service_rows_value from completed_items;
 insert into public.reporting_runs(business_id,report_key,definition_version,period_start,period_end,time_basis,freshness_at,filters) values(target_business_id,'customer_service_mix',1,period_start_value,period_end_value,'UTC',generated_at_value,jsonb_build_object('location_scope','authorized','completion_basis','booking_updated_at')) returning id into run_id_value;
 return jsonb_build_object('run_id',run_id_value,'definition_version',1,'period',jsonb_build_object('start',period_start_value,'end',period_end_value,'time_basis','UTC','completion_basis','booking_updated_at'),'freshness',jsonb_build_object('status','current','as_of',generated_at_value),'summary',summary_value,'service_mix',service_rows_value,'definitions',jsonb_build_object('first_time_completed_customer','Customer whose first authorized completed booking occurs in the selected period.','returning_completed_customer','Customer with an authorized completed booking before the selected period and another in it.','repeat_customer_rate','Returning completed customers divided by customers with a completed booking in the selected period.','service_mix','Completed booking items grouped by their immutable service-version name and category.'));
end;$$;
revoke all on function app.get_customer_service_mix_report(uuid,timestamptz,timestamptz) from public;grant execute on function app.get_customer_service_mix_report(uuid,timestamptz,timestamptz) to authenticated;
