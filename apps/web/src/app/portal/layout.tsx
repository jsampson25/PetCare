import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolvePortalDashboard } from '../../lib/auth/portal-context';

const customerNavigation = [
  { href: '/portal', label: 'Overview' },
  { href: '/portal/reservations', label: 'Reservations' },
  { href: '/portal/pets', label: 'My pets' },
  { href: '/portal/billing', label: 'Billing' },
  { href: '/portal/report-cards', label: 'Report cards' },
  { href: '/portal/messages', label: 'Messages' },
] as const;

export default async function CustomerPortalLayout({ children }: { children: ReactNode }) {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) redirect('/denied');
  return (
    <AppShell
      contextLabel={`${dashboard.business.name} · ${dashboard.household.display_name}`}
      items={customerNavigation}
      kind="customer"
    >
      {children}
    </AppShell>
  );
}
