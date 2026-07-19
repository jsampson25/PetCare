import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

type BillingEvent = {
  business_name: string;
  event_id: string;
  event_type: string;
  outcome_reason: string | null;
  processed_at: string | null;
  provider_created_at: string;
  provider_event_id: string;
  provider_subscription_reference: string;
  received_at: string;
  signature_verified: boolean;
  status: 'applied' | 'failed' | 'quarantined' | 'received' | 'stale';
  target_status: string;
};

export default async function PlatformBillingPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_platform_saas_billing_reconciliation');
  const events = (data ?? []) as BillingEvent[];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform commerce</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">SaaS billing reconciliation</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Verified provider evidence, ordered subscription convergence, and quarantined anomalies.
        </p>
      </header>
      <Alert title="Separate from pet-owner payments" tone="info">
        These events update only the business-to-PetCare subscription. They never create or modify a
        customer invoice, deposit, payment, refund, receipt, or booking balance.
      </Alert>
      {error ? (
        <Alert title="Billing reconciliation unavailable" tone="danger">
          Provider-event metadata could not be loaded.
        </Alert>
      ) : null}
      {!error && events.length === 0 ? (
        <Alert title="No provider events" tone="info">
          Verified SaaS subscription events will appear here after provider setup.
        </Alert>
      ) : null}
      <div className="grid gap-5">
        {events.map((event) => (
          <Card key={event.event_id} title={`${event.business_name} · ${event.event_type}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  event.status === 'applied'
                    ? 'success'
                    : event.status === 'quarantined' || event.status === 'failed'
                      ? 'danger'
                      : event.status === 'stale'
                        ? 'warning'
                        : 'info'
                }
              >
                {event.status}
              </Badge>
              <Badge tone={event.signature_verified ? 'success' : 'danger'}>
                {event.signature_verified ? 'signature verified' : 'signature rejected'}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                Target {event.target_status} · provider time{' '}
                {new Date(event.provider_created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs">{event.provider_event_id}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {event.outcome_reason ?? 'Awaiting the reconciliation worker.'}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
