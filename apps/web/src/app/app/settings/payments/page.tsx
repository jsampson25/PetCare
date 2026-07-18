import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { startStripeOnboarding } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function PaymentSettingsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.manage')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: merchant }, { data: events }] = await Promise.all([
    supabase
      .from('merchant_accounts')
      .select(
        'id,provider_account_id,status,charges_enabled,payouts_enabled,details_submitted,dashboard_access,requirements_collector,fees_payer,losses_payer,last_synced_at,requirements_currently_due,disabled_reason',
      )
      .eq('business_id', context.businessId)
      .maybeSingle(),
    supabase
      .from('processor_webhook_events')
      .select('id,provider_event_id,event_type,status,quarantine_reason,received_at,attempt_count')
      .eq('business_id', context.businessId)
      .order('received_at', { ascending: false })
      .limit(25),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Finance settings</p>
        <h1 className="text-3xl font-black tracking-tight">Payment connection</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Connected merchant identity, capabilities, and verified processor events.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Payment settings updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Payment settings failed" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <Card
        title="Stripe merchant account"
        description="Merchant identity is created only through verified Stripe-hosted onboarding."
      >
        {merchant ? (
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-sm font-bold">Connection</p>
              <p>{merchant.provider_account_id}</p>
              <Badge tone={merchant.status === 'active' ? 'success' : 'warning'}>
                {merchant.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-bold">Capabilities</p>
              <p>Charges: {merchant.charges_enabled ? 'enabled' : 'blocked'}</p>
              <p>Payouts: {merchant.payouts_enabled ? 'enabled' : 'blocked'}</p>
            </div>
            <div>
              <p className="text-sm font-bold">Responsibility</p>
              <p>Requirements: {merchant.requirements_collector}</p>
              <p>Losses: {merchant.losses_payer}</p>
            </div>
          </div>
        ) : (
          <Alert title="Online collection unavailable" tone="warning">
            No verified connected merchant account is mapped to this business. Stripe-hosted
            onboarding will be added in the next payment slice.
          </Alert>
        )}
        <form action={startStripeOnboarding} className="mt-5">
          <Button type="submit">
            {merchant ? 'Continue Stripe onboarding' : 'Connect with Stripe'}
          </Button>
        </form>
      </Card>
      <Card
        title="Verified webhook inbox"
        description="Only signature-verified events appear here; unknown merchant accounts remain quarantined."
      >
        {events?.length ? (
          <div className="divide-y">
            {events.map((event) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                key={event.id}
              >
                <div>
                  <p className="font-bold">{event.event_type}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {event.provider_event_id} ·{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(event.received_at))}
                  </p>
                  {event.quarantine_reason ? (
                    <p className="text-sm text-[var(--status-danger)]">
                      {event.quarantine_reason.replaceAll('_', ' ')}
                    </p>
                  ) : null}
                </div>
                <Badge
                  tone={
                    event.status === 'processed'
                      ? 'success'
                      : event.status === 'quarantined'
                        ? 'danger'
                        : 'info'
                  }
                >
                  {event.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No verified processor events received for this merchant.
          </p>
        )}
      </Card>
    </div>
  );
}
