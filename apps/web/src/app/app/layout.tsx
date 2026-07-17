import { AppShell } from '@petcare/ui/app-shell';
import type { ReactNode } from 'react';

const businessNavigation = [
  { href: '/app', label: 'Today' },
  { href: '/app/calendar', label: 'Calendar', requiredPermissions: ['bookings.read'] },
  { href: '/app/customers', label: 'Customers', requiredPermissions: ['customers.read'] },
  { href: '/app/design-system', label: 'Design system' },
  { href: '/app/settings', label: 'Settings', requiredPermissions: ['business.manage'] },
] as const;

const demonstrationPermissions = new Set(['bookings.read', 'customers.read', 'business.manage']);

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      contextLabel="Happy Paws Resort"
      items={businessNavigation}
      kind="business"
      permissions={demonstrationPermissions}
    >
      {children}
    </AppShell>
  );
}
