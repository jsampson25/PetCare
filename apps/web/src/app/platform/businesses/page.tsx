import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { transitionTenant } from './actions';
type Tenant = {
  active_member_count: number;
  business_id: string;
  business_status: string;
  changed_at: string;
  created_at: string;
  lifecycle_status: string;
  location_count: number;
  name: string;
  public_slug: string;
  restriction_code: string | null;
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
            {canManage ? (
              <form
                action={transitionTenant}
                className="mt-5 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2"
              >
                <input name="businessId" type="hidden" value={tenant.business_id} />
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
