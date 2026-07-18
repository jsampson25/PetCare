import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolveBusinessContext } from '../../lib/auth/tenant-context';

const businessNavigation = [
  { href: '/app', label: 'Today' },
  { href: '/app/bookings', label: 'Bookings', requiredPermissions: ['bookings.view'] },
  { href: '/app/calendar', label: 'Calendar', requiredPermissions: ['bookings.view'] },
  { href: '/app/arrivals', label: 'Arrivals', requiredPermissions: ['operations.check_in'] },
  { href: '/app/tasks', label: 'Care work', requiredPermissions: ['operations.record_feeding'] },
  {
    href: '/app/observations',
    label: 'Care log',
    requiredPermissions: ['operations.record_observation'],
  },
  {
    href: '/app/service-board',
    label: 'Service boards',
    requiredPermissions: ['operations.execute_service'],
  },
  {
    href: '/app/playgroups',
    label: 'Playgroups',
    requiredPermissions: ['operations.manage_playgroup'],
  },
  {
    href: '/app/grooming',
    label: 'Grooming QA',
    requiredPermissions: ['operations.manage_grooming'],
  },
  {
    href: '/app/incidents',
    label: 'Incidents',
    requiredPermissions: ['operations.record_incident'],
  },
  {
    href: '/app/report-cards',
    label: 'Report cards',
    requiredPermissions: ['operations.manage_report_cards'],
  },
  { href: '/app/invoices', label: 'Invoices', requiredPermissions: ['payments.view'] },
  {
    href: '/app/availability',
    label: 'Availability',
    requiredPermissions: ['capacity.view', 'pets.view'],
  },
  { href: '/app/quotes', label: 'Quotes', requiredPermissions: ['quotes.create'] },
  { href: '/app/customers', label: 'Customers', requiredPermissions: ['customers.view'] },
  { href: '/app/settings/staff', label: 'Staff', requiredPermissions: ['staff.invite'] },
  { href: '/app/settings/services', label: 'Services', requiredPermissions: ['services.view'] },
  { href: '/app/settings/pricing', label: 'Pricing', requiredPermissions: ['pricing.view'] },
  { href: '/app/settings/payments', label: 'Payments', requiredPermissions: ['payments.manage'] },
  { href: '/app/settings/security', label: 'Security' },
  { href: '/app/design-system', label: 'Design system' },
  { href: '/onboarding/setup', label: 'Setup', requiredPermissions: ['business.manage_profile'] },
  { href: '/app/settings', label: 'Settings', requiredPermissions: ['business.manage_profile'] },
  { href: '/auth/select-business', label: 'Switch business' },
  { href: '/auth/sign-out', label: 'Sign out' },
] as const;

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/select-business');
  if (context.requiresMfa && context.sessionAssuranceLevel !== 'aal2') {
    redirect('/auth/mfa?next=/app');
  }
  return (
    <AppShell
      contextLabel={context.businessName}
      items={businessNavigation}
      kind="business"
      permissions={context.permissions}
    >
      {children}
    </AppShell>
  );
}
