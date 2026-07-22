import { AppShell } from '@petcare/ui/app-shell';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { TrialBanner } from '../../components/trial-banner';
import { resolveBusinessContext } from '../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

const businessNavigation = [
  { href: '/app', label: 'Today' },
  { href: '/app/bookings', label: 'Bookings', requiredPermissions: ['bookings.view'] },
  { href: '/app/calendar', label: 'Calendar', requiredPermissions: ['bookings.view'] },
  { href: '/app/arrivals', label: 'Arrivals', requiredPermissions: ['operations.check_in'] },
  { href: '/app/departures', label: 'Departures', requiredPermissions: ['operations.check_out'] },
  {
    href: '/app/turnover',
    label: 'Turnover',
    requiredPermissions: ['operations.clean_resources'],
  },
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
    href: '/app/reports',
    label: 'Reports',
    requiredPermissions: ['reports.view_summary'],
  },
  {
    href: '/app/availability',
    label: 'Availability',
    requiredPermissions: ['capacity.view', 'pets.view'],
  },
  { href: '/app/quotes', label: 'Quotes', requiredPermissions: ['quotes.create'] },
  { href: '/app/customers', label: 'Customers', requiredPermissions: ['customers.view'] },
  {
    href: '/app/customer-requests',
    label: 'Customer requests',
    requiredPermissions: ['customers.manage'],
  },
  { href: '/app/settings/staff', label: 'Staff', requiredPermissions: ['staff.invite'] },
  { href: '/app/settings/services', label: 'Services', requiredPermissions: ['services.view'] },
  { href: '/app/settings/pricing', label: 'Pricing', requiredPermissions: ['pricing.view'] },
  { href: '/app/settings/payments', label: 'Payments', requiredPermissions: ['payments.manage'] },
  { href: '/app/settings/security', label: 'Security' },
  { href: '/app/settings/website', label: 'Website', requiredPermissions: ['website.edit'] },
  {
    href: '/app/website-inquiries',
    label: 'Website inquiries',
    requiredPermissions: ['website.edit'],
  },
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
