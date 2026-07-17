import { AppShell } from '@petcare/ui/app-shell';
import type { ReactNode } from 'react';

const customerNavigation = [
  { href: '/portal', label: 'Overview' },
  { href: '/portal/reservations', label: 'Reservations' },
  { href: '/portal/pets', label: 'My pets' },
  { href: '/portal/messages', label: 'Messages' },
] as const;

export default function CustomerPortalLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell contextLabel="The Sampson family" items={customerNavigation} kind="customer">
      {children}
    </AppShell>
  );
}
