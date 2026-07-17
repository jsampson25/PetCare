-- Token-bound invitation preview for the public acceptance screen.
-- Possession of a 256-bit token is required; unavailable invitations return no row.

create or replace function app.get_staff_invitation_preview(invitation_token text)
returns table (
  business_name text,
  invited_email text,
  role_names text[],
  location_names text[],
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    business.name,
    invitation.email,
    coalesce(
      array_agg(distinct role.display_name order by role.display_name)
        filter (where role.display_name is not null),
      array[]::text[]
    ),
    case
      when invitation.location_scope_mode = 'all_current' then array['All current locations']::text[]
      else coalesce(
        array_agg(distinct location.name order by location.name)
          filter (where location.name is not null),
        array[]::text[]
      )
    end,
    invitation.expires_at
  from public.staff_invitations invitation
  join public.businesses business on business.id = invitation.business_id
  join public.staff_invitation_roles invitation_role
    on invitation_role.business_id = invitation.business_id
    and invitation_role.invitation_id = invitation.id
  join public.role_definitions role on role.role_key = invitation_role.role_key
  left join public.staff_invitation_location_scopes invitation_scope
    on invitation_scope.business_id = invitation.business_id
    and invitation_scope.invitation_id = invitation.id
  left join public.locations location
    on location.business_id = invitation_scope.business_id
    and location.id = invitation_scope.location_id
  where invitation_token is not null
    and char_length(invitation_token) >= 32
    and invitation.token_digest = extensions.digest(invitation_token, 'sha256')
    and invitation.state = 'pending'
    and invitation.expires_at > now()
    and business.status in ('draft', 'active')
  group by business.name, invitation.email, invitation.location_scope_mode, invitation.expires_at;
$$;

revoke all on function app.get_staff_invitation_preview(text) from public;
grant execute on function app.get_staff_invitation_preview(text) to anon, authenticated;
