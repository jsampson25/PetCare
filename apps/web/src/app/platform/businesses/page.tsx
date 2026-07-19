import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { transitionTenant } from './actions';
type Tenant = {
  active_member_count: number;
  block_marketing: boolean;
  block_new_bookings: boolean;
  business_id: string;
  business_status: string;
  changed_at: string;
  created_at: string;
  lifecycle_status: string;
  location_count: number;
  name: string;
  impact: {
    active_pets_in_care: number;
    active_staff_members: number;
    fingerprint: string;
    future_bookings: number;
    open_care_tasks: number;
    published_website: boolean;
    unpaid_invoice_count: number;
  };
  preserve_care_access: boolean;
  public_slug: string;
  review_at: string | null;
  restriction_code: string | null;
  tenant_read_only: boolean;
};
export default async function PlatformBusinessesPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_platform_tenants');
  const tenants = (data ?? []) as Tenant[];
  const canManage = context.permissions.has('platform.businesses.manage');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tenant directory</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Safe administrative metadata without customer, pet, booking, care, or payment browsing.
        </p>
      </header>
      {error ? (
        <Alert title="Tenant directory unavailable" tone="danger">
          Cross-tenant metadata could not be loaded.
        </Alert>
      ) : null}
      <div className="grid gap-5">
        {tenants.map((tenant) => (
          <Card key={tenant.business_id} title={tenant.name}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  tenant.lifecycle_status === 'active'
                    ? 'success'
                    : tenant.lifecycle_status === 'suspended'
                      ? 'warning'
                      : 'info'
                }
              >
                {tenant.lifecycle_status}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                {tenant.public_slug} · {tenant.location_count} location(s) ·{' '}
                {tenant.active_member_count} active member(s)
              </span>
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Control changed {new Date(tenant.changed_at).toLocaleString()}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Pets currently in care', tenant.impact.active_pets_in_care],
                ['Future bookings', tenant.impact.future_bookings],
                ['Open care tasks', tenant.impact.open_care_tasks],
                ['Unpaid invoices', tenant.impact.unpaid_invoice_count],
              ].map(([label, value]) => (
                <div className="rounded-lg border border-[var(--border)] p-3" key={label}>
                  <p className="text-xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                </div>
              ))}
            </div>
            <Alert title="Restriction impact preview" tone="warning">
              New bookings and marketing will stop. Existing care access remains available so staff
              can record care and complete checkout. Suspension additionally makes ordinary tenant
              administration read-only. This preview must still match when the change is submitted.
            </Alert>
            {canManage ? (
              <form
                action={transitionTenant}
                className="mt-5 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2"
              >
                <input name="businessId" type="hidden" value={tenant.business_id} />
                <input name="impactFingerprint" type="hidden" value={tenant.impact.fingerprint} />
                <label className="grid gap-1 text-sm font-semibold">
                  Next status
                  <select
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                    name="nextStatus"
                    required
                  >
                    <option value="">Select</option>
                    <option value="active">Active</option>
                    <option value="restricted">Restricted</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Restriction code
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    name="restrictionCode"
                    placeholder="billing_review"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
                  Documented reason
                  <textarea
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
                  Required review time for a restriction
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    name="reviewAt"
                    type="datetime-local"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
                  Type slug to confirm suspension
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    name="confirmation"
                    placeholder={tenant.public_slug}
                  />
                </label>
                <div>
                  <Button type="submit">Apply controlled change</Button>
                </div>
              </form>
            ) : null}
          </Card>
        ))}
        {!error && tenants.length === 0 ? (
          <Card>
            <p className="text-[var(--text-secondary)]">No tenants are registered.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
