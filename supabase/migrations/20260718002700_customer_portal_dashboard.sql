-- PetCare E12 explicit customer portal authority and household dashboard projection.
create table public.customer_portal_access(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,customer_id uuid not null,household_id uuid not null,identity_id uuid not null references auth.users(id) on delete restrict,
 status text not null default 'active' check(status in('invited','active','revoked')),granted_by uuid not null references auth.users(id) on delete restrict default auth.uid(),granted_at timestamptz not null default now(),revoked_at timestamptz,
 unique(business_id,id),unique(business_id,identity_id),foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,foreign key(business_id,household_id) references public.households(business_id,id) on delete restrict,
 check((status='revoked')=(revoked_at is not null))
);
create index customer_portal_access_identity_idx on public.customer_portal_access(identity_id,status,business_id);
create trigger customer_portal_access_tenant before update on public.customer_portal_access for each row execute function app.prevent_business_id_change();
create trigger customer_portal_access_audit after insert or update or delete on public.customer_portal_access for each row execute function app.audit_configuration_change('customer.portal_access.changed','customer_portal_access');

create or replace function app.grant_customer_portal_access(target_business_id uuid,target_customer_id uuid,target_identity_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$declare access_id uuid;household_id_value uuid;begin
 if not app.member_has_permission(target_business_id,'customers.manage') then raise exception 'portal grant unavailable' using errcode='42501';end if;
 select hm.household_id into household_id_value from public.household_members hm join public.customers c on c.business_id=hm.business_id and c.id=hm.customer_id where hm.business_id=target_business_id and hm.customer_id=target_customer_id and c.status='active';
 if household_id_value is null or not exists(select 1 from public.identity_profiles p where p.id=target_identity_id and p.state='active') then raise exception 'portal customer or identity unavailable' using errcode='22023';end if;
 insert into public.customer_portal_access(business_id,customer_id,household_id,identity_id,status) values(target_business_id,target_customer_id,household_id_value,target_identity_id,'active')
 on conflict(business_id,identity_id) do update set customer_id=excluded.customer_id,household_id=excluded.household_id,status='active',revoked_at=null,granted_by=auth.uid(),granted_at=now() returning id into access_id;return access_id;
end;$$;

create or replace function app.get_customer_portal_dashboard(target_business_id uuid)
returns jsonb language plpgsql security definer stable set search_path='' as $$declare access_record public.customer_portal_access%rowtype;result jsonb;begin
 select * into access_record from public.customer_portal_access where business_id=target_business_id and identity_id=auth.uid() and status='active';
 if access_record.id is null then raise exception 'customer portal unavailable' using errcode='42501';end if;
 select jsonb_build_object(
  'business',jsonb_build_object('id',b.id,'name',b.name),
  'household',jsonb_build_object('id',h.id,'display_name',h.display_name),
  'customer',jsonb_build_object('id',c.id,'first_name',c.first_name,'last_name',c.last_name,'preferred_name',c.preferred_name,'email',c.email,'phone',c.phone),
  'pets',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'breed',p.breed,'birth_date',p.birth_date,'sex',p.sex,'vaccinations',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'type',v.vaccine_type,'expires_on',v.expires_on,'review_status',v.review_status) order by v.expires_on) from public.pet_vaccinations v where v.business_id=p.business_id and v.pet_id=p.id),'[]'::jsonb)) order by p.name) from public.pets p where p.business_id=access_record.business_id and p.household_id=access_record.household_id and p.status='active'),'[]'::jsonb),
  'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',bk.id,'booking_number',bk.booking_number,'status',bk.status,'created_at',bk.created_at,'location_name',l.name,'items',coalesce((select jsonb_agg(jsonb_build_object('id',bi.id,'pet_id',bi.pet_id,'pet_name',p.name,'service_name',sv.customer_name,'starts_at',bi.starts_at,'ends_at',bi.ends_at,'status',bi.status) order by bi.starts_at) from public.booking_items bi join public.pets p on p.business_id=bi.business_id and p.id=bi.pet_id join public.service_versions sv on sv.business_id=bi.business_id and sv.id=bi.service_version_id where bi.business_id=bk.business_id and bi.booking_id=bk.id),'[]'::jsonb)) order by bk.created_at desc) from public.bookings bk join public.locations l on l.business_id=bk.business_id and l.id=bk.location_id where bk.business_id=access_record.business_id and bk.customer_id=access_record.customer_id),'[]'::jsonb),
  'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'status',i.status,'currency_code',i.currency_code,'issued_at',i.issued_at,'due_at',i.due_at,'total_minor',iv.total_minor,'balance_due_minor',coalesce(ib.balance_due_minor,iv.total_minor)) order by i.created_at desc) from public.invoices i join public.invoice_versions iv on iv.business_id=i.business_id and iv.invoice_id=i.id and iv.version_number=i.current_version_number left join public.invoice_balances ib on ib.business_id=i.business_id and ib.invoice_id=i.id where i.business_id=access_record.business_id and i.customer_id=access_record.customer_id and i.status<>'void'),'[]'::jsonb),
  'report_cards',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'pet_id',r.pet_id,'pet_name',p.name,'service_category',r.service_category,'published_at',r.published_at,'narrative',rv.narrative,'highlights',rv.highlights) order by r.published_at desc) from public.report_cards r join public.report_card_versions rv on rv.business_id=r.business_id and rv.report_card_id=r.id and rv.version_number=r.current_version_number join public.pets p on p.business_id=r.business_id and p.id=r.pet_id where r.business_id=access_record.business_id and r.status='published' and p.household_id=access_record.household_id),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'message_type',m.message_type,'channel',m.channel,'status',m.status,'created_at',m.created_at,'sent_at',m.sent_at) order by m.created_at desc) from public.transactional_message_outbox m where m.business_id=access_record.business_id and m.customer_id=access_record.customer_id),'[]'::jsonb)
 ) into result from public.businesses b join public.households h on h.business_id=b.id and h.id=access_record.household_id join public.customers c on c.business_id=b.id and c.id=access_record.customer_id where b.id=access_record.business_id;
 return result;
end;$$;

alter table public.customer_portal_access enable row level security;alter table public.customer_portal_access force row level security;
revoke all on public.customer_portal_access from anon,authenticated;grant select on public.customer_portal_access to authenticated;
create policy customer_portal_access_self on public.customer_portal_access for select to authenticated using(identity_id=auth.uid() and status='active');
revoke all on function app.grant_customer_portal_access(uuid,uuid,uuid),app.get_customer_portal_dashboard(uuid) from public;
grant execute on function app.grant_customer_portal_access(uuid,uuid,uuid),app.get_customer_portal_dashboard(uuid) to authenticated;
