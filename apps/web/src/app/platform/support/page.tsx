import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { openSupportSession, revokeSupportSession } from './actions';

type Tenant = { business_id: string; name: string; public_slug: string };
type SupportSession = {
  business_name: string;
  case_key: string;
  case_summary: string;
  expires_at: string;
  public_slug: string;
  scopes: string[];
  session_id: string;
  started_at: string;
  status: 'active' | 'expired' | 'revoked';
  write_enabled: boolean;
};

const supportScopes = ['configuration', 'operations', 'communications', 'commerce', 'audit'];

export default async function PlatformSupportPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [sessionResult, tenantResult] = await Promise.all([
    supabase.rpc('list_platform_support_sessions'),
    supabase.rpc('list_platform_tenants'),
  ]);
  const sessions = (sessionResult.data ?? []) as SupportSession[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const canManage = context.permissions.has('platform.support.manage');
  const canWrite = context.permissions.has('platform.support.write');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform support</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Support access</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Case-linked access under your own operator identity, with narrow scopes and automatic
          expiry.
        </p>
      </header>
      <Alert title="Support mode never impersonates a tenant user" tone="warning">
        Start with safe diagnostics. Tenant-domain access requires an active session, and write
        access allows only separately authorized domain commands.
      </Alert>
      {sessionResult.error || tenantResult.error ? (
        <Alert title="Support access unavailable" tone="danger">
          Session metadata could not be loaded. No access was granted.
        </Alert>
      ) : null}

      {canManage && tenants.length ? (
        <Card title="Open a support session">
          <form action={openSupportSession} className="grid gap-4 md:grid-cols-2">
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
              Support case
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 uppercase"
                name="caseKey"
                pattern="[A-Za-z][A-Za-z0-9-]{5,39}"
                placeholder="SUP-1042"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Case summary
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="caseSummary"
                required
              />
            </label>
            <fieldset className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:col-span-2">
              <legend className="px-1 text-sm font-semibold">Required scopes</legend>
              <div className="flex flex-wrap gap-4">
                {supportScopes.map((scope) => (
                  <label className="flex items-center gap-2 text-sm" key={scope}>
                    <input name="scopes" type="checkbox" value={scope} />
                    {scope}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1 text-sm font-semibold">
              Duration
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                defaultValue="30"
                name="durationMinutes"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </select>
            </label>
            {canWrite ? (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input name="writeEnabled" type="checkbox" />
                Permit supported write commands
              </label>
            ) : null}
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Access reason
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="reason"
                required
              />
            </label>
            <div>
              <Button type="submit">Open timed session</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-5">
        {sessions.map((session) => (
          <Card key={session.session_id} title={`${session.case_key} · ${session.business_name}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  session.status === 'active'
                    ? 'success'
                    : session.status === 'expired'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {session.status}
              </Badge>
              <Badge tone={session.write_enabled ? 'warning' : 'info'}>
                {session.write_enabled ? 'read + supported write' : 'read only'}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                {session.scopes.join(', ')}
              </span>
            </div>
            <p className="mt-3 text-sm">{session.case_summary}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Expires {new Date(session.expires_at).toLocaleString()}
            </p>
            {canManage && session.status === 'active' ? (
              <form action={revokeSupportSession} className="mt-4 flex flex-wrap items-end gap-3">
                <input name="sessionId" type="hidden" value={session.session_id} />
                <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold">
                  Revocation reason
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <Button type="submit" variant="secondary">
                  Revoke now
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
