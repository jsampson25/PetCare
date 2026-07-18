-- PetCare E13 time-weighted capacity utilization at the local operating-day grain.
alter table public.reporting_runs drop constraint reporting_runs_report_key_check;
alter table public.reporting_runs add constraint reporting_runs_report_key_check check(report_key in('business_summary','booking_activity','capacity_utilization'));

create or replace function app.get_capacity_utilization_report(target_business_id uuid,start_date_value date,end_date_value date) returns jsonb language plpgsql security definer set search_path='' as $$
declare generated_at_value timestamptz:=clock_timestamp();run_id_value uuid;rows_value jsonb;
begin
 if not app.member_has_permission(target_business_id,'reports.view_operational') then raise exception 'capacity utilization report unavailable' using errcode='42501';end if;
 if start_date_value is null or end_date_value is null or end_date_value<start_date_value or end_date_value-start_date_value>366 then raise exception 'valid report period required' using errcode='22023';end if;
 with authorized_pools as(
  select cp.*,l.name location_name,l.time_zone,s.internal_name service_name from public.capacity_pools cp join public.locations l on l.business_id=cp.business_id and l.id=cp.location_id join public.services s on s.business_id=cp.business_id and s.id=cp.service_id
  where cp.business_id=target_business_id and cp.status='active' and app.member_can_access_location(cp.business_id,cp.location_id)
 ),days as(
  select ap.*,(start_date_value+day_offset) local_date,((start_date_value+day_offset)::timestamp at time zone ap.time_zone) day_start,((start_date_value+day_offset+1)::timestamp at time zone ap.time_zone) day_end,
   coalesce((select o.capacity from public.capacity_overrides o where o.business_id=ap.business_id and o.capacity_pool_id=ap.id and start_date_value+day_offset between o.starts_on and o.ends_on order by o.created_at desc limit 1),ap.configured_capacity) sellable_units
  from authorized_pools ap cross join generate_series(0,end_date_value-start_date_value) day_offset
 ),measures as(
  select d.*,(extract(epoch from(d.day_end-d.day_start))/3600.0*d.sellable_units)::numeric sellable_hours,
   coalesce((select sum(extract(epoch from(least(cc.ends_at,d.day_end)-greatest(cc.starts_at,d.day_start)))/3600.0*cc.quantity) from public.capacity_commitments cc where cc.business_id=d.business_id and cc.capacity_pool_id=d.id and cc.status in('active','completed') and cc.starts_at<d.day_end and cc.ends_at>d.day_start),0)::numeric occupied_hours
  from days d
 )
 select coalesce(jsonb_agg(jsonb_build_object('local_date',local_date,'location_name',location_name,'time_zone',time_zone,'service_name',service_name,'pool_name',name,'sellable_units',sellable_units,'sellable_resource_hours',round(sellable_hours,2),'occupied_resource_hours',round(occupied_hours,2),'occupancy_rate_percent',case when sellable_hours>0 then round(least(occupied_hours/sellable_hours*100,100),1) else 0 end) order by local_date,location_name,service_name,name),'[]'::jsonb) into rows_value from measures;
 insert into public.reporting_runs(business_id,report_key,definition_version,period_start,period_end,time_basis,freshness_at,filters)
 select target_business_id,'capacity_utilization',1,(start_date_value::timestamp at time zone b.default_time_zone),((end_date_value+1)::timestamp at time zone b.default_time_zone),'UTC',generated_at_value,jsonb_build_object('location_scope','authorized','day_basis','location_local_time') from public.businesses b where b.id=target_business_id returning id into run_id_value;
 return jsonb_build_object('run_id',run_id_value,'definition_version',1,'period',jsonb_build_object('start_date',start_date_value,'end_date',end_date_value,'day_basis','location_local_time'),'freshness',jsonb_build_object('status','current','as_of',generated_at_value),'definitions',jsonb_build_object('sellable_resource_hours','Configured or overridden capacity multiplied by the actual local-day duration.','occupied_resource_hours','Eligible committed quantity multiplied by overlapping hours.','occupancy_rate','Summed occupied resource-hours divided by summed sellable resource-hours.'),'rows',rows_value);
end;$$;
revoke all on function app.get_capacity_utilization_report(uuid,date,date) from public;grant execute on function app.get_capacity_utilization_report(uuid,date,date) to authenticated;
