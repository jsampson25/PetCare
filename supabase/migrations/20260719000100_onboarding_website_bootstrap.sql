-- Provision the first private website draft before the owner completes MFA.
-- Normal editing and publishing continue to require the governed website permissions.
create or replace function app.bootstrap_tenant_website_draft(
  target_business_id uuid,
  theme_value text,
  brand_value jsonb,
  content_value jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_id uuid;
begin
  if not exists (
    select 1
    from public.businesses business
    join public.business_memberships membership
      on membership.business_id = business.id
      and membership.identity_id = auth.uid()
      and membership.state = 'active'
    join public.membership_roles membership_role
      on membership_role.business_id = membership.business_id
      and membership_role.membership_id = membership.id
      and membership_role.role_key = 'owner'
    where business.id = target_business_id
      and business.created_by = auth.uid()
      and business.status = 'draft'
  ) then
    raise exception 'website bootstrap unavailable' using errcode = '42501';
  end if;

  if theme_value not in ('modern', 'warm', 'classic')
    or jsonb_typeof(brand_value) <> 'object'
    or jsonb_typeof(content_value) <> 'object'
    or coalesce(brand_value ->> 'primary', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(brand_value ->> 'accent', '') !~ '^#[0-9A-Fa-f]{6}$'
  then
    raise exception 'valid governed website content required' using errcode = '22023';
  end if;

  insert into public.tenant_websites (business_id, theme_key, brand_tokens, draft_content)
  values (target_business_id, theme_value, brand_value, content_value)
  on conflict (business_id) do nothing
  returning id into site_id;

  if site_id is null then
    select website.id into site_id
    from public.tenant_websites website
    where website.business_id = target_business_id;
  end if;

  return site_id;
end;
$$;

revoke all on function app.bootstrap_tenant_website_draft(uuid, text, jsonb, jsonb) from public;
grant execute on function app.bootstrap_tenant_website_draft(uuid, text, jsonb, jsonb) to authenticated;
