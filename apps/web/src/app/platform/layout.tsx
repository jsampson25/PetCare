import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolvePlatformContext } from '../../lib/auth/platform-context';

const platformNavigation = [
  { href: '/platform', label: 'Platform health' },
  {
    href: '/platform/businesses',
    label: 'Businesses',
    requiredPermissions: ['platform.businesses.read'],
  },
  {
    href: '/platform/provisioning',
    label: 'Provisioning',
    requiredPermissions: ['platform.provisioning.read'],
  },
  {
    href: '/platform/subscriptions',
    label: 'Subscriptions',
    requiredPermissions: ['platform.subscriptions.read'],
  },
  {
    href: '/platform/billing',
    label: 'Billing reconciliation',
    requiredPermissions: ['platform.subscriptions.read'],
  },
  {
    href: '/platform/communications',
    label: 'Notices and notes',
    requiredPermissions: ['platform.communications.read'],
  },
  {
    href: '/platform/closures',
    label: 'Tenant closure',
    requiredPermissions: ['platform.closure.read'],
  },
  {
    href: '/platform/features',
    label: 'Feature controls',
    requiredPermissions: ['platform.features.read'],
  },
  {
    href: '/platform/support',
    label: 'Support access',
    requiredPermissions: ['platform.support.read'],
  },
  {
    href: '/platform/jobs',
    label: 'Administrative jobs',
    requiredPermissions: ['platform.jobs.read'],
  },
  {
    href: '/platform/privacy',
    label: 'Privacy requests',
    requiredPermissions: ['platform.privacy.read'],
  },
  { href: '/platform/audit', label: 'Audit', requiredPermissions: ['platform.audit.read'] },
] as const;

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const context = await resolvePlatformContext();
  if (!context) redirect('/denied');
  if (context.requiresMfa && context.sessionAssuranceLevel !== 'aal2')
    redirect('/auth/mfa?next=/platform');
  return (
    <AppShell
      contextLabel="PetCare operations"
      items={platformNavigation}
      kind="platform"
      permissions={context.permissions}
    >
      {children}
    </AppShell>
  );
}
