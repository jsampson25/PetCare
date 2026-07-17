import { AppShell } from '@petcare/ui/app-shell';
import type { ReactNode } from 'react';

const platformNavigation = [
  { href: '/platform', label: 'Platform health' },
  { href: '/platform/businesses', label: 'Businesses', requiredPermissions: ['platform.businesses.read'] },
  { href: '/platform/audit', label: 'Audit', requiredPermissions: ['platform.audit.read'] },
] as const;

const demonstrationPermissions = new Set(['platform.businesses.read', 'platform.audit.read']);

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      contextLabel="PetCare operations"
      items={platformNavigation}
      kind="platform"
      permissions={demonstrationPermissions}
    >
      {children}
    </AppShell>
  );
}
