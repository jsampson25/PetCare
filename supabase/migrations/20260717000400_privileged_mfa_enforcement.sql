-- Enforce MFA in database authorization, not only in application routing.

create or replace function app.membership_session_meets_mfa(
  target_business_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.membership_roles membership_role
      join public.role_definitions role on role.role_key = membership_role.role_key
      where membership_role.business_id = target_business_id
        and membership_role.membership_id = target_membership_id
        and role.requires_mfa
    )
    or app.session_has_aal2();
$$;

create or replace function app.member_has_permission(
  target_business_id uuid,
  target_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    join public.identity_profiles identity on identity.id = membership.identity_id
    join public.businesses business on business.id = membership.business_id
    join public.membership_roles membership_role
      on membership_role.business_id = membership.business_id
      and membership_role.membership_id = membership.id
    join public.role_permissions role_permission
      on role_permission.role_key = membership_role.role_key
    where membership.business_id = target_business_id
      and membership.identity_id = auth.uid()
      and membership.state = 'active'
      and identity.status = 'active'
      and business.status in ('draft', 'active')
      and role_permission.permission_key = target_permission_key
      and app.membership_session_meets_mfa(membership.business_id, membership.id)
  );
$$;

create or replace function app.member_can_access_location(
  target_business_id uuid,
  target_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    join public.identity_profiles identity on identity.id = membership.identity_id
    join public.businesses business on business.id = membership.business_id
    where membership.business_id = target_business_id
      and membership.identity_id = auth.uid()
      and membership.state = 'active'
      and identity.status = 'active'
      and business.status in ('draft', 'active')
      and app.membership_session_meets_mfa(membership.business_id, membership.id)
      and (
        membership.location_scope_mode = 'all_current'
        or exists (
          select 1
          from public.membership_location_scopes location_scope
          where location_scope.business_id = target_business_id
            and location_scope.membership_id = membership.id
            and location_scope.location_id = target_location_id
        )
      )
  );
$$;

revoke all on function app.membership_session_meets_mfa(uuid, uuid) from public;
