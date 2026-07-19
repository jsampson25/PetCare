import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { addRetentionHold, createClosureCase, markExportReady, transitionClosure } from './actions';
type Tenant = { business_id: string; name: string; public_slug: string };
type Readiness = {
  active_holds: number;
  active_pets_in_care: number;
  export_ready: boolean;
  fingerprint: string;
  future_bookings: number;
  outstanding_balance_minor: number;
  purge_permitted: boolean;
  ready_to_close: boolean;
};
type Closure = {
  business_name: string;
  case_id: string;
  export_ready: boolean;
  holds: { basis: string; hold_id: string; hold_type: string; status: string }[];
  public_slug: string;
  readiness: Readiness;
  retention_until: string;
  status: 'review' | 'closing' | 'closed' | 'purge_eligible';
  target_close_at: string;
};
export default async function PlatformClosuresPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [caseResult, tenantResult] = await Promise.all([
    supabase.rpc('list_tenant_closure_cases'),
    supabase.rpc('list_platform_tenants'),
  ]);
  const cases = (caseResult.data ?? []) as Closure[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const canManage = context.permissions.has('platform.closure.manage');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Lifecycle governance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tenant closure</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Resolve care, bookings, balances, exports, and retention before closure or purge
          eligibility.
        </p>
      </header>
      <Alert title="Closure is not deletion" tone="warning">
        Closing disables tenant use while retained records remain governed. Purge eligibility is a
        separate decision and this workflow never performs an immediate cascade delete.
      </Alert>
      {caseResult.error || tenantResult.error ? (
        <Alert title="Closure coordination unavailable" tone="danger">
          Safe administrative metadata could not be loaded.
        </Alert>
      ) : null}
      {canManage && tenants.length ? (
        <Card title="Open a closure review">
          <form action={createClosureCase} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Tenant
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="businessId"
              >
                {tenants.map((t) => (
                  <option key={t.business_id} value={t.business_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Target close time
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="targetCloseAt"
                type="datetime-local"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Retention through
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="retentionUntil"
                type="date"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Documented reason
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="reason"
                required
              />
            </label>
            <div>
              <Button type="submit">Open review</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-5">
        {cases.map((c) => (
          <Card key={c.case_id} title={c.business_name}>
            <div className="flex flex-wrap gap-2">
              <Badge
                tone={
                  c.status === 'purge_eligible'
                    ? 'danger'
                    : c.status === 'closed'
                      ? 'warning'
                      : 'info'
                }
              >
                {c.status.replaceAll('_', ' ')}
              </Badge>
              <Badge tone={c.readiness.ready_to_close ? 'success' : 'warning'}>
                {c.readiness.ready_to_close ? 'ready to close' : 'blockers remain'}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
              <p>
                <strong>{c.readiness.active_pets_in_care}</strong>
                <br />
                pets in care
              </p>
              <p>
                <strong>{c.readiness.future_bookings}</strong>
                <br />
                future bookings
              </p>
              <p>
                <strong>{c.readiness.outstanding_balance_minor}</strong>
                <br />
                outstanding minor units
              </p>
              <p>
                <strong>{c.readiness.active_holds}</strong>
                <br />
                active holds
              </p>
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Target {new Date(c.target_close_at).toLocaleString()} · retain through{' '}
              {new Date(c.retention_until).toLocaleDateString()}
            </p>
            {canManage && !c.export_ready && c.status === 'review' ? (
              <form
                action={markExportReady}
                className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2"
              >
                <input name="caseId" type="hidden" value={c.case_id} />
                <label className="grid gap-1 text-sm font-semibold">
                  Minimized export reference
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={8}
                    name="exportReference"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Verification reason
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <div>
                  <Button type="submit" variant="secondary">
                    Mark export ready
                  </Button>
                </div>
              </form>
            ) : null}
            {canManage && c.status !== 'purge_eligible' ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <form
                  action={addRetentionHold}
                  className="grid gap-3 rounded-lg border border-[var(--border)] p-4"
                >
                  <input name="caseId" type="hidden" value={c.case_id} />
                  <label className="grid gap-1 text-sm font-semibold">
                    Hold type
                    <select
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                      name="holdType"
                    >
                      <option>legal</option>
                      <option>financial</option>
                      <option>security</option>
                      <option>privacy</option>
                      <option>contract</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Basis
                    <input
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      minLength={12}
                      name="basis"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Optional expiry
                    <input
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      name="expiresAt"
                      type="datetime-local"
                    />
                  </label>
                  <div>
                    <Button type="submit" variant="secondary">
                      Add hold
                    </Button>
                  </div>
                </form>
                <form
                  action={transitionClosure}
                  className="grid gap-3 rounded-lg border border-[var(--border)] p-4"
                >
                  <input name="caseId" type="hidden" value={c.case_id} />
                  <input name="fingerprint" type="hidden" value={c.readiness.fingerprint} />
                  <input
                    name="nextStatus"
                    type="hidden"
                    value={
                      c.status === 'review'
                        ? 'closing'
                        : c.status === 'closing'
                          ? 'closed'
                          : 'purge_eligible'
                    }
                  />
                  <label className="grid gap-1 text-sm font-semibold">
                    Reason
                    <input
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      minLength={12}
                      name="reason"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Type tenant slug
                    <input
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      name="confirmation"
                      placeholder={c.public_slug}
                      required
                    />
                  </label>
                  <div>
                    <Button type="submit">
                      Advance to{' '}
                      {c.status === 'review'
                        ? 'closing'
                        : c.status === 'closing'
                          ? 'closed'
                          : 'purge eligible'}
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
