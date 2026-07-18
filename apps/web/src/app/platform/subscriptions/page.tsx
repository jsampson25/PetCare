import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { assignSubscription, transitionSubscription } from './actions';
type Plan = {
  billing_interval: string;
  currency_code: string;
  display_name: string;
  entitlements: Record<string, unknown>;
  plan_key: string;
  trial_days: number;
  unit_amount_minor: number;
  version_id: string;
};
type Subscription = {
  billing_interval: string | null;
  business_id: string;
  business_name: string;
  cancel_at_period_end: boolean;
  currency_code: string | null;
  current_period_end: string | null;
  entitlements: Record<string, unknown> | null;
  plan_name: string | null;
  public_slug: string;
  status: string | null;
  trial_ends_at: string | null;
  unit_amount_minor: number | null;
};
function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { currency, style: 'currency' }).format(value / 100);
}
export default async function SubscriptionsPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [planResult, subscriptionResult] = await Promise.all([
    supabase.rpc('list_saas_plans'),
    supabase.rpc('list_tenant_saas_subscriptions'),
  ]);
  const plans = (planResult.data ?? []) as Plan[];
  const subscriptions = (subscriptionResult.data ?? []) as Subscription[];
  const canManage = context.permissions.has('platform.subscriptions.manage');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform commerce</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">SaaS subscriptions</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Pet-care businesses paying PetCare, fully separate from their customer invoices and
          payments.
        </p>
      </header>
      <Alert title="Separate commercial boundary" tone="info">
        These subscriptions never appear in a pet owner invoice, booking balance, refund, receipt,
        or tenant financial report.
      </Alert>
      {planResult.error || subscriptionResult.error ? (
        <Alert title="Subscription directory unavailable" tone="danger">
          Plan or subscription metadata could not be loaded.
        </Alert>
      ) : null}
      <div className="grid gap-5">
        {subscriptions.map((item) => (
          <Card key={item.business_id} title={item.business_name}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  item.status === 'active'
                    ? 'success'
                    : item.status === 'past_due'
                      ? 'warning'
                      : 'info'
                }
              >
                {item.status ?? 'unassigned'}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">{item.public_slug}</span>
            </div>
            {item.status && item.currency_code && item.unit_amount_minor != null ? (
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  <strong>{item.plan_name}</strong>
                </p>
                <p>
                  {money(item.unit_amount_minor, item.currency_code)} / {item.billing_interval}
                </p>
                <p>
                  Period ends{' '}
                  {item.current_period_end
                    ? new Date(item.current_period_end).toLocaleDateString()
                    : '—'}
                </p>
              </div>
            ) : null}
            {canManage && !item.status && plans[0] ? (
              <form
                action={assignSubscription}
                className="mt-5 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2"
              >
                <input name="businessId" type="hidden" value={item.business_id} />
                <label className="grid gap-1 text-sm font-semibold">
                  Plan
                  <select
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                    name="planVersionId"
                  >
                    {plans.map((plan) => (
                      <option key={plan.version_id} value={plan.version_id}>
                        {plan.display_name} · {money(plan.unit_amount_minor, plan.currency_code)}/
                        {plan.billing_interval}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input defaultChecked name="startAsTrial" type="checkbox" />
                  Start available trial
                </label>
                <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
                  Assignment reason
                  <textarea
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <div>
                  <Button type="submit">Assign subscription</Button>
                </div>
              </form>
            ) : null}
            {canManage && item.status ? (
              <form
                action={transitionSubscription}
                className="mt-5 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2"
              >
                <input name="businessId" type="hidden" value={item.business_id} />
                <label className="grid gap-1 text-sm font-semibold">
                  Next state
                  <select
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                    name="nextStatus"
                    required
                  >
                    <option value="">Select</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="cancel_scheduled">Cancel scheduled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Documented reason
                  <textarea
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <div>
                  <Button type="submit">Apply state change</Button>
                </div>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
