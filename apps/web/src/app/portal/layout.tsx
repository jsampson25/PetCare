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
  return (
    <AppShell
      contextLabel={`${dashboard.business.name} · ${dashboard.household.display_name}`}
      items={customerNavigation}
      kind="customer"
      brandName={brand?.business_name ?? dashboard.business.name}
      brandTokens={brand?.brand_tokens ?? undefined}
    >
      {children}
    </AppShell>
  );
}
