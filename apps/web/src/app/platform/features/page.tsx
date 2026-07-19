import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { configureFeature, setFeatureOverride } from './actions';

type FeatureControl = {
  active_override_count: number;
  changed_at: string;
  description: string;
  display_name: string;
  entitlement_key: string | null;
  feature_key: string;
  release_state: 'disabled' | 'enabled' | 'kill_switch';
  rollout_percentage: number;
};

type Tenant = { business_id: string; name: string; public_slug: string };

export default async function PlatformFeaturesPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;

  const supabase = await createSupabaseServerClient();
  const [featureResult, tenantResult] = await Promise.all([
    supabase.rpc('list_platform_feature_controls'),
    supabase.rpc('list_platform_tenants'),
  ]);
  const features = (featureResult.data ?? []) as FeatureControl[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const canManage = context.permissions.has('platform.features.manage');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Release operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Feature controls</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Roll out eligible capabilities predictably or stop unsafe behavior immediately.
        </p>
      </header>

      <Alert title="Entitlement remains authoritative" tone="info">
        A release flag can expose code only to a tenant that is entitled to the capability. An
        emergency kill switch always wins over rollout and tenant overrides.
      </Alert>

      {featureResult.error || tenantResult.error ? (
        <Alert title="Feature controls unavailable" tone="danger">
          Release metadata could not be loaded. No control was changed.
        </Alert>
      ) : null}

      {canManage ? (
        <Card title="Create or update a feature">
          <form action={configureFeature} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Feature key
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="featureKey"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Display name
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="displayName"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Description
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="description"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Required entitlement (optional)
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="entitlementKey"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Release state
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="releaseState"
                required
              >
                <option value="disabled">Disabled</option>
                <option value="enabled">Enabled</option>
                <option value="kill_switch">Emergency kill switch</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Stable rollout percentage
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                defaultValue="0"
                max="100"
                min="0"
                name="rolloutPercentage"
                type="number"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Feature-key confirmation for kill switch
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="confirmation"
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
              <Button type="submit">Apply feature control</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-5">
        {features.map((feature) => (
          <Card key={feature.feature_key} title={feature.display_name}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  feature.release_state === 'enabled'
                    ? 'success'
                    : feature.release_state === 'kill_switch'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {feature.release_state.replace('_', ' ')}
              </Badge>
              <span className="font-mono text-xs">{feature.feature_key}</span>
              <span className="text-sm text-[var(--text-secondary)]">
                {feature.rollout_percentage}% stable rollout
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">{feature.description}</p>
            <p className="mt-2 text-sm">
              Entitlement: <strong>{feature.entitlement_key ?? 'None required'}</strong> · Active
              overrides: <strong>{feature.active_override_count}</strong>
            </p>
            {canManage && tenants.length ? (
              <form
                action={setFeatureOverride}
                className="mt-5 grid gap-3 rounded-lg border border-[var(--border)] p-4 md:grid-cols-2"
              >
                <input name="featureKey" type="hidden" value={feature.feature_key} />
                <label className="grid gap-1 text-sm font-semibold">
                  Tenant
                  <select
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                    name="businessId"
                    required
                  >
                    {tenants.map((tenant) => (
                      <option key={tenant.business_id} value={tenant.business_id}>
                        {tenant.name} ({tenant.public_slug})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Override
                  <select
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                    name="overrideState"
                    required
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Expiration (optional)
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    name="expiresAt"
                    type="datetime-local"
                  />
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
                  <Button type="submit" variant="secondary">
                    Set tenant override
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
