-- PetCare E12 purpose-bound, expiring, single-use customer portal invitations.
create table public.customer_portal_invitations(
 id uuid primary key default gen_random_uuid(),business_id uuid not null,customer_id uuid not null,household_id uuid not null,email text not null check(email=lower(trim(email)) and position('@' in email)>1),
 token_digest bytea not null unique check(octet_length(token_digest)=32),state text not null default 'pending' check(state in('pending','accepted','revoked','expired','superseded')),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid references auth.users(id) on delete restrict,revoked_at timestamptz,revoked_by uuid references auth.users(id) on delete restrict,created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),
 unique(business_id,id),foreign key(business_id,customer_id) references public.customers(business_id,id) on delete restrict,foreign key(business_id,household_id) references public.households(business_id,id) on delete restrict,
 check(expires_at>created_at),check((state='accepted')=(accepted_at is not null and accepted_by is not null)),check((state='revoked')=(revoked_at is not null and revoked_by is not null))
);
create unique index customer_portal_invitation_pending_idx on public.customer_portal_invitations(business_id,customer_id) where state='pending';
create trigger customer_portal_invitations_tenant before update on public.customer_portal_invitations for each row execute function app.prevent_business_id_change();
create trigger customer_portal_invitations_audit after insert or update or delete on public.customer_portal_invitations for each row execute function app.audit_configuration_change('customer.portal_invitation.changed','customer_portal_invitation');

create or replace function app.create_customer_portal_invitation(target_business_id uuid,target_customer_id uuid,target_expires_in interval default interval '7 days')
returns table(invitation_id uuid,invitation_token text,expires_at timestamptz) language plpgsql security definer set search_path='' as $$declare customer_record public.customers%rowtype;household_id_value uuid;raw_token text;created_id uuid;created_expiry timestamptz;begin
 if not app.member_has_permission(target_business_id,'customers.manage') then raise exception 'portal invitation unavailable' using errcode='42501';end if;
 select * into customer_record from public.customers c where c.business_id=target_business_id and c.id=target_customer_id and c.status='active';select hm.household_id into household_id_value from public.household_members hm where hm.business_id=target_business_id and hm.customer_id=target_customer_id;
 if customer_record.id is null or target_expires_in<interval '1 hour' or target_expires_in>interval '30 days' or exists(select 1 from public.customer_portal_access a where a.business_id=target_business_id and a.customer_id=target_customer_id and a.status='active') then raise exception 'portal invitation unavailable' using errcode='22023';end if;
 update public.customer_portal_invitations set state='superseded' where business_id=target_business_id and customer_id=target_customer_id and state='pending';raw_token:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');created_expiry:=now()+target_expires_in;
 insert into public.customer_portal_invitations(business_id,customer_id,household_id,email,token_digest,expires_at) values(target_business_id,target_customer_id,household_id_value,customer_record.email,extensions.digest(raw_token,'sha256'),created_expiry) returning id into created_id;
 return query select created_id,raw_token,created_expiry;end;$$;

create or replace function app.get_customer_portal_invitation_preview(invitation_token text)
returns table(business_name text,household_name text,invited_email text,expires_at timestamptz) language sql security definer stable set search_path='' as $$select b.name,h.display_name,i.email,i.expires_at from public.customer_portal_invitations i join public.businesses b on b.id=i.business_id join public.households h on h.business_id=i.business_id and h.id=i.household_id where i.token_digest=extensions.digest(invitation_token,'sha256') and i.state='pending' and i.expires_at>now()$$;

create or replace function app.accept_customer_portal_invitation(invitation_token text)
returns uuid language plpgsql security definer set search_path='' as $$declare invitation public.customer_portal_invitations%rowtype;access_id uuid;begin
 select * into invitation from public.customer_portal_invitations where token_digest=extensions.digest(invitation_token,'sha256') for update;
 if invitation.id is null or invitation.state<>'pending' or invitation.expires_at<=now() or app.current_auth_email() is distinct from invitation.email or not exists(select 1 from public.identity_profiles p where p.id=auth.uid() and p.status='active') then raise exception 'portal invitation unavailable' using errcode='P0002';end if;
 insert into public.customer_portal_access(business_id,customer_id,household_id,identity_id,status) values(invitation.business_id,invitation.customer_id,invitation.household_id,auth.uid(),'active') on conflict(business_id,identity_id) do update set customer_id=excluded.customer_id,household_id=excluded.household_id,status='active',revoked_at=null,granted_by=invitation.created_by,granted_at=now() returning id into access_id;
 update public.customer_portal_invitations set state='accepted',accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;return access_id;end;$$;

create or replace function app.revoke_customer_portal_access(target_business_id uuid,target_customer_id uuid,reason_value text)
returns void language plpgsql security definer set search_path='' as $$begin if not app.member_has_permission(target_business_id,'customers.manage') or char_length(trim(coalesce(reason_value,'')))<5 then raise exception 'portal revocation unavailable' using errcode='42501';end if;update public.customer_portal_access set status='revoked',revoked_at=now() where business_id=target_business_id and customer_id=target_customer_id and status='active';if not found then raise exception 'portal access unavailable' using errcode='P0002';end if;perform app.write_audit_event(target_business_id,auth.uid(),'customer.portal_access_revoked','customer',target_customer_id,jsonb_build_object('reason',trim(reason_value)));end;$$;

alter table public.customer_portal_invitations enable row level security;alter table public.customer_portal_invitations force row level security;revoke all on public.customer_portal_invitations from anon,authenticated;grant select on public.customer_portal_invitations to authenticated;
create policy customer_portal_invitations_staff on public.customer_portal_invitations for select to authenticated using(app.member_has_permission(business_id,'customers.manage'));
revoke all on function app.create_customer_portal_invitation(uuid,uuid,interval),app.get_customer_portal_invitation_preview(text),app.accept_customer_portal_invitation(text),app.revoke_customer_portal_access(uuid,uuid,text) from public;
grant execute on function app.get_customer_portal_invitation_preview(text) to anon,authenticated;grant execute on function app.create_customer_portal_invitation(uuid,uuid,interval),app.accept_customer_portal_invitation(text),app.revoke_customer_portal_access(uuid,uuid,text) to authenticated;
