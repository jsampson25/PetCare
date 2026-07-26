import { validateTenantActionColor } from '@petcare/config/tenant-theme';
import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolvePortalDashboard } from '../../lib/auth/portal-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

const customerNavigation = [
  { href: '/portal', label: 'Overview' },
  { href: '/portal/reservations', label: 'Reservations' },
  { href: '/portal/pets', label: 'My pets' },
  { href: '/portal/billing', label: 'Billing' },
  { href: '/portal/report-cards', label: 'Report cards' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/requests', label: 'Requests' },
  { href: '/portal/account', label: 'Account' },
] as const;

export default async function CustomerPortalLayout({ children }: { children: ReactNode }) {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.rpc('get_customer_portal_brand', {
    target_business_id: dashboard.business.id,
  });
  const logoMedia = brand?.logo_media as
    { object_path?: string; alt_text?: string } | null | undefined;
  const logoUrl = logoMedia?.object_path
    ? supabase.storage.from('tenant-website-media').getPublicUrl(logoMedia.object_path).data
        .publicUrl
    : undefined;
  const brandTokens = brand?.brand_tokens as
    { primary?: string; primaryText?: string; accent?: string } | undefined;
  const validatedPrimary = brandTokens?.primary
    ? validateTenantActionColor(brandTokens.primary)
    : null;
  const accessibleBrandTokens = brandTokens
    ? {
        ...brandTokens,
        primaryText:
          brandTokens.primaryText ??
          (validatedPrimary?.accepted ? validatedPrimary.actionTextColor : undefined),
      }
    : undefined;
  return (
    <AppShell
      accountDetail={dashboard.customer.email}
      accountHref="/portal/account"
      accountName={
        dashboard.customer.preferred_name ||
        `${dashboard.customer.first_name} ${dashboard.customer.last_name}`.trim() ||
        dashboard.customer.email
      }
      brandLogoAlt={logoMedia?.alt_text}
      brandLogoUrl={logoUrl}
      contextLabel={`${dashboard.business.name} / ${dashboard.household.display_name}`}
      items={customerNavigation}
      kind="customer"
      brandName={brand?.business_name ?? dashboard.business.name}
      brandTokens={accessibleBrandTokens}
    >
      {children}
    </AppShell>
  );
}
