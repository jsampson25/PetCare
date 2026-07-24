import { validateTenantActionColor } from '@petcare/config/tenant-theme';

import { createSupabaseServerClient } from '../supabase/server';

export type PublicTenantBrand = {
  logoAlt?: string;
  logoUrl?: string;
  name: string;
  primary: string;
  primaryText: string;
  slug: string;
};

export function getTenantSlug(value: string | string[] | undefined) {
  if (typeof value !== 'string') return '';
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : '';
}

export async function loadPublicTenantBrand(slug: string): Promise<PublicTenantBrand | null> {
  if (!slug) return null;

  const supabase = await createSupabaseServerClient();
  const { data: site } = await supabase.rpc('get_public_tenant_website', {
    public_slug_value: slug,
  });
  if (!site) return null;

  const logoMedia = site.content?.logo_media as
    { alt_text?: string; object_path?: string } | null | undefined;
  const logoUrl = logoMedia?.object_path
    ? supabase.storage.from('tenant-website-media').getPublicUrl(logoMedia.object_path).data
        .publicUrl
    : undefined;
  const primary =
    typeof site.brand_tokens?.primary === 'string' ? site.brand_tokens.primary : '#2563eb';
  const validatedPrimary = validateTenantActionColor(primary);

  return {
    logoAlt: logoMedia?.alt_text,
    logoUrl,
    name: site.business.name,
    primary,
    primaryText:
      typeof site.brand_tokens?.primaryText === 'string'
        ? site.brand_tokens.primaryText
        : validatedPrimary.accepted
          ? validatedPrimary.actionTextColor
          : '#ffffff',
    slug: site.business.slug,
  };
}
