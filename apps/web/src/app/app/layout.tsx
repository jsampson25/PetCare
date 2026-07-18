import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolveBusinessContext } from '../../lib/auth/tenant-context';

const businessNavigation = [
  { href: '/app', label: 'Today' },
  { href: '/app/calendar', label: 'Calendar', requiredPermissions: ['bookings.view'] },
  { href: '/app/customers', label: 'Customers', requiredPermissions: ['customers.view'] },
  { href: '/app/settings/staff', label: 'Staff', requiredPermissions: ['staff.invite'] },
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
