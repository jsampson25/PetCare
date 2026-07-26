import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { TrialBanner } from '../../components/trial-banner';
import { resolveBusinessContext } from '../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

const businessNavigation = [
  { group: 'Workspace', href: '/app', icon: 'home', label: 'Today' },
  {
    group: 'Workspace',
    href: '/app/calendar',
    icon: 'calendar',
    label: 'Calendar',
    requiredPermissions: ['bookings.view'],
  },
  {
    group: 'Workspace',
    href: '/app/bookings',
    icon: 'booking',
    label: 'Bookings',
    requiredPermissions: ['bookings.view'],
  },
  {
    group: 'Front desk',
    href: '/app/arrivals',
    icon: 'arrivals',
    label: 'Arrivals',
    requiredPermissions: ['operations.check_in'],
  },
  {
    group: 'Front desk',
    href: '/app/departures',
    icon: 'departures',
    label: 'Departures',
    requiredPermissions: ['operations.check_out'],
  },
  {
    group: 'Front desk',
    href: '/app/turnover',
    icon: 'care',
    label: 'Turnover',
    requiredPermissions: ['operations.clean_resources'],
  },
  {
    group: 'Care operations',
    href: '/app/tasks',
    icon: 'clipboard',
    label: 'Care work',
    requiredPermissions: ['operations.record_feeding'],
  },
  {
    group: 'Care operations',
    href: '/app/observations',
    icon: 'care',
    label: 'Care log',
    requiredPermissions: ['operations.record_observation'],
  },
  {
    group: 'Care operations',
    href: '/app/service-board',
    icon: 'clipboard',
    label: 'Service boards',
    requiredPermissions: ['operations.execute_service'],
  },
  {
    group: 'Care operations',
    href: '/app/playgroups',
    icon: 'pets',
    label: 'Playgroups',
    requiredPermissions: ['operations.manage_playgroup'],
  },
  {
    group: 'Care operations',
    href: '/app/grooming',
    icon: 'pets',
    label: 'Grooming QA',
    requiredPermissions: ['operations.manage_grooming'],
  },
  {
    group: 'Care operations',
    href: '/app/incidents',
    icon: 'shield',
    label: 'Incidents',
    requiredPermissions: ['operations.record_incident'],
  },
  {
    group: 'Care operations',
    href: '/app/report-cards',
    icon: 'clipboard',
    label: 'Report cards',
    requiredPermissions: ['operations.manage_report_cards'],
  },
  {
    group: 'Business',
    href: '/app/customers',
    icon: 'users',
    label: 'Customers',
    requiredPermissions: ['customers.view'],
  },
  {
    group: 'Business',
    href: '/app/customer-requests',
    icon: 'users',
    label: 'Customer requests',
    requiredPermissions: ['customers.manage'],
  },
  {
    group: 'Business',
    href: '/app/invoices',
    icon: 'money',
    label: 'Invoices',
    requiredPermissions: ['payments.view'],
  },
  {
    group: 'Business',
    href: '/app/reports',
    icon: 'chart',
    label: 'Reports',
    requiredPermissions: ['reports.view_summary'],
  },
  {
    group: 'Business',
    href: '/app/availability',
    icon: 'calendar',
    label: 'Availability',
    requiredPermissions: ['capacity.view', 'pets.view'],
  },
  {
    group: 'Business',
    href: '/app/quotes',
    icon: 'money',
    label: 'Quotes',
    requiredPermissions: ['quotes.create'],
  },
  {
    group: 'Manage',
    href: '/app/settings/website',
    icon: 'website',
    label: 'Website',
    requiredPermissions: ['website.edit'],
  },
  {
    group: 'Manage',
    href: '/app/website-inquiries',
    icon: 'website',
    label: 'Website inquiries',
    requiredPermissions: ['website.edit'],
  },
  {
    group: 'Manage',
    href: '/app/settings/staff',
    icon: 'users',
    label: 'Staff',
    requiredPermissions: ['staff.invite'],
  },
  {
    group: 'Manage',
    href: '/app/settings/services',
    icon: 'settings',
    label: 'Services',
    requiredPermissions: ['services.view'],
  },
  {
    group: 'Manage',
    href: '/app/settings/pricing',
    icon: 'money',
    label: 'Pricing',
    requiredPermissions: ['pricing.view'],
  },
  {
    group: 'Manage',
    href: '/app/settings/payments',
    icon: 'money',
    label: 'Payments',
    requiredPermissions: ['payments.manage'],
  },
  { group: 'Manage', href: '/app/settings/security', icon: 'shield', label: 'Security' },
  {
    group: 'Manage',
    href: '/onboarding/setup',
    icon: 'settings',
    label: 'Business setup',
    requiredPermissions: ['business.manage_profile'],
  },
  {
    group: 'Manage',
    href: '/app/settings',
    icon: 'settings',
    label: 'Settings',
    requiredPermissions: ['business.manage_profile'],
  },
  {
    group: 'Account',
    href: '/auth/select-business',
    icon: 'users',
    label: 'Switch business',
  },
  { group: 'Account', href: '/auth/sign-out', icon: 'logout', label: 'Sign out' },
] as const;

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/select-business');
  if (context.requiresMfa && context.sessionAssuranceLevel !== 'aal2') {
    redirect('/auth/mfa?next=/app');
  }
  const supabase = await createSupabaseServerClient();
  const { data: subscriptionRows } = await supabase
    .schema('app')
    .rpc('get_tenant_subscription_summary', { target_business_id: context.businessId });
  const subscription = subscriptionRows?.[0] as
    | {
        plan_name: string;
        subscription_status: string;
        trial_days_remaining: number | null;
        trial_ends_at: string | null;
      }
    | undefined;
  return (
    <AppShell
      accountDetail={context.accountEmail}
      accountHref="/app/settings/security"
      accountName={context.accountName}
      brandLogoAlt="Roventra"
      brandLogoMode="lockup"
      brandLogoUrl="/brand/roventra-logo-kit/roventra-unified-white.png"
      brandName="Roventra"
      brandTokens={{ accent: '#60a5fa', primary: '#2864ed', primaryText: '#ffffff' }}
      contextLabel={context.businessName}
      items={businessNavigation}
      kind="business"
      permissions={context.permissions}
    >
      {subscription?.subscription_status === 'trialing' &&
      subscription.trial_ends_at &&
      subscription.trial_days_remaining !== null ? (
        <TrialBanner
          planName={subscription.plan_name}
          remainingDays={subscription.trial_days_remaining}
          trialEndsAt={subscription.trial_ends_at}
        />
      ) : null}
      {children}
    </AppShell>
  );
}
