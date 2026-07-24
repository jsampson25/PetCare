-- Carry the published tenant logo into the authenticated customer portal.
create or replace function app.get_customer_portal_brand(target_business_id uuid)
returns jsonb
language sql
security definer
stable
set search_path=''
as $$
  select jsonb_build_object(
    'business_name', b.name,
    'public_slug', b.public_slug,
    'theme_key', coalesce(p.theme_key, w.theme_key),
    'brand_tokens', coalesce(p.brand_tokens, w.brand_tokens),
    'logo_media', case
      when p.id is not null then p.content->'logo_media'
      else w.draft_content->'logo_media'
    end
  )
  from public.customer_portal_access a
  join public.businesses b on b.id=a.business_id
  left join public.tenant_websites w on w.business_id=b.id
  left join public.tenant_website_publications p
    on p.business_id=w.business_id
   and p.tenant_website_id=w.id
   and p.publication_number=w.current_publication_number
  where a.business_id=target_business_id
    and a.identity_id=auth.uid()
    and a.status='active'
$$;
