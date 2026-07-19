import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { createOperationalIssue, transitionOperationalIssue } from './actions';

type Health = {
  active_support_sessions: number;
  failed_retryable_jobs: number;
  open_critical_issues: number;
  overdue_privacy_requests: number;
  subscriptions_past_due: number;
  tenants: { active: number; restricted: number; suspended: number; total: number };
};
type Issue = {
  business_name: string | null;
  correlation_key: string;
  impact_summary: string;
  issue_id: string;
  issue_number: number;
  severity: 'critical' | 'info' | 'warning';
  status: 'monitoring' | 'open' | 'resolved';
  summary: string;
};
type Tenant = { business_id: string; name: string; public_slug: string };

export default async function PlatformHomePage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [healthResult, issueResult, tenantResult] = await Promise.all([
    supabase.rpc('get_platform_health_summary'),
    supabase.rpc('list_platform_operational_issues'),
    supabase.rpc('list_platform_tenants'),
  ]);
  const health = healthResult.data as Health | null;
  const issues = (issueResult.data ?? []) as Issue[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const canManage = context.permissions.has('platform.health.manage');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Platform health</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Cross-tenant aggregates and sanitized issue correlation without customer or pet browsing.
        </p>
      </header>
      {healthResult.error || issueResult.error || tenantResult.error ? (
        <Alert title="Platform health unavailable" tone="danger">
          One or more approved health projections could not be loaded.
        </Alert>
      ) : null}
      {health ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card title="Tenants">
            <p className="text-3xl font-bold">{health.tenants.total}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {health.tenants.active} active · {health.tenants.restricted} restricted ·{' '}
              {health.tenants.suspended} suspended
            </p>
          </Card>
          <Card title="Commercial">
            <p className="text-3xl font-bold">{health.subscriptions_past_due}</p>
            <p className="text-sm text-[var(--text-secondary)]">subscriptions past due</p>
          </Card>
          <Card title="Operations">
            <p className="text-3xl font-bold">{health.failed_retryable_jobs}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              retryable failures · {health.active_support_sessions} support sessions
            </p>
          </Card>
          <Card title="Guardrails">
            <p className="text-3xl font-bold">{health.open_critical_issues}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              critical issues · {health.overdue_privacy_requests} overdue privacy
            </p>
          </Card>
        </div>
      ) : null}

      {canManage ? (
        <Card title="Record a correlated issue">
          <form action={createOperationalIssue} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Tenant (optional)
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="businessId"
              >
                <option value="">Platform-wide</option>
                {tenants.map((tenant) => (
                  <option key={tenant.business_id} value={tenant.business_id}>
                    {tenant.name} ({tenant.public_slug})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Correlation key
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="correlationKey"
                placeholder="provider:stripe:incident-42"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Source
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="sourceType"
              >
                <option value="provider">Provider</option>
                <option value="deployment">Deployment</option>
                <option value="tenant">Tenant</option>
                <option value="subscription">Subscription</option>
                <option value="feature">Feature</option>
                <option value="support">Support</option>
                <option value="job">Job</option>
                <option value="privacy">Privacy</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Severity
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="severity"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Source reference
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="sourceReference"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Summary
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="summary"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Tenant impact
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="impactSummary"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Recording reason
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="reason"
                required
              />
            </label>
            <div>
              <Button type="submit">Record issue</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-5">
        {issues.map((issue) => (
          <Card key={issue.issue_id} title={`ISS-${issue.issue_number} · ${issue.summary}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  issue.severity === 'critical'
                    ? 'danger'
                    : issue.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
              >
                {issue.severity}
              </Badge>
              <Badge tone={issue.status === 'resolved' ? 'success' : 'neutral'}>
                {issue.status}
              </Badge>
              <span className="font-mono text-xs">{issue.correlation_key}</span>
            </div>
            <p className="mt-3 text-sm">{issue.impact_summary}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {issue.business_name ?? 'Platform-wide'}
            </p>
            {canManage && issue.status !== 'resolved' ? (
              <form
                action={transitionOperationalIssue}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input name="issueId" type="hidden" value={issue.issue_id} />
                <label className="grid gap-1 text-sm font-semibold">
                  Next state
                  <select
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                    name="nextStatus"
                  >
                    <option value="monitoring">Monitoring</option>
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold">
                  Reason
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <Button type="submit" variant="secondary">
                  Update issue
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
