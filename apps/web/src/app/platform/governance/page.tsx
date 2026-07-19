import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  activateBreakGlass,
  approvePurge,
  endBreakGlass,
  requestPurge,
  reviewBreakGlass,
} from './actions';

type Tenant = { business_id: string; name: string; public_slug: string };
type Session = {
  id: string;
  business_id: string;
  incident_key: string;
  scopes: string[];
  status: string;
  expires_at: string;
  review_due_at: string;
};
type Closure = {
  case_id: string;
  business_name: string;
  public_slug: string;
  status: string;
  readiness: { fingerprint: string; purge_permitted: boolean };
};
type Purge = {
  id: string;
  business_id: string;
  status: string;
  requested_at: string;
  reason: string;
};
const field = 'rounded-lg border border-[var(--border)] bg-white px-3 py-2';

export default async function GovernancePage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [tenantsResult, sessionsResult, closuresResult, purgesResult] = await Promise.all([
    supabase.rpc('list_platform_tenants'),
    supabase
      .from('platform_break_glass_sessions')
      .select('id,business_id,incident_key,scopes,status,expires_at,review_due_at')
      .order('started_at', { ascending: false }),
    supabase.rpc('list_tenant_closure_cases'),
    supabase
      .from('tenant_purge_requests')
      .select('id,business_id,status,requested_at,reason')
      .order('requested_at', { ascending: false }),
  ]);
  const tenants = (tenantsResult.data ?? []) as Tenant[];
  const sessions = (sessionsResult.data ?? []) as Session[];
  const closures = (closuresResult.data ?? []) as Closure[];
  const purges = (purgesResult.data ?? []) as Purge[];
  const canBreakGlass = context.permissions.has('platform.break_glass.manage');
  const canPurge = context.permissions.has('platform.purge.manage');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Safety governance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Emergency access and purge</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Time-bound emergency access and separately authorized irreversible lifecycle work.
        </p>
      </header>
      <Alert title="No shortcut around evidence" tone="warning">
        Break-glass access expires within 15 minutes and requires review. Purge execution remains
        service-only and stores minimized evidence, never deleted customer content.
      </Alert>
      {canBreakGlass ? (
        <Card title="Activate emergency access">
          <form action={activateBreakGlass} className="grid gap-3 md:grid-cols-2">
            <select className={field} name="businessId">
              {tenants.map((t) => (
                <option key={t.business_id} value={t.business_id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              className={field}
              name="incidentKey"
              pattern="[A-Z][A-Z0-9-]{5,39}"
              placeholder="INC-1234"
              required
            />
            <fieldset className="flex gap-4 text-sm">
              <label>
                <input name="scopes" type="checkbox" value="operations" /> Operations
              </label>
              <label>
                <input name="scopes" type="checkbox" value="security" /> Security
              </label>
              <label>
                <input name="scopes" type="checkbox" value="audit" /> Audit
              </label>
            </fieldset>
            <textarea
              className={field}
              minLength={20}
              name="reason"
              placeholder="Document the emergency need"
              required
            />
            <Button type="submit">Activate for 15 minutes</Button>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-4">
        {sessions.map((s) => (
          <Card key={s.id} title={s.incident_key}>
            <div className="flex gap-3">
              <Badge tone={s.status === 'active' ? 'warning' : 'info'}>{s.status}</Badge>
              <span className="text-sm">{s.scopes.join(', ')}</span>
            </div>
            {canBreakGlass && s.status === 'active' ? (
              <form action={endBreakGlass} className="mt-3 flex gap-2">
                <input name="sessionId" type="hidden" value={s.id} />
                <input
                  className={field}
                  minLength={12}
                  name="reason"
                  placeholder="Why access is ending"
                  required
                />
                <Button type="submit">End access</Button>
              </form>
            ) : null}
            {canBreakGlass && s.status === 'ended' ? (
              <form action={reviewBreakGlass} className="mt-3 grid gap-2 md:grid-cols-3">
                <input name="sessionId" type="hidden" value={s.id} />
                <select className={field} name="outcome">
                  <option value="appropriate">Appropriate</option>
                  <option value="policy_exception">Policy exception</option>
                  <option value="investigation_required">Investigation required</option>
                </select>
                <input
                  className={field}
                  minLength={12}
                  name="reason"
                  placeholder="Review evidence"
                  required
                />
                <Button type="submit">Complete review</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
      {canPurge ? (
        <Card title="Request eligible purge">
          {closures
            .filter((c) => c.status === 'purge_eligible' && c.readiness.purge_permitted)
            .map((c) => (
              <form
                action={requestPurge}
                className="mb-4 grid gap-2 md:grid-cols-4"
                key={c.case_id}
              >
                <input name="caseId" type="hidden" value={c.case_id} />
                <input name="fingerprint" type="hidden" value={c.readiness.fingerprint} />
                <strong>{c.business_name}</strong>
                <input className={field} name="confirmation" placeholder={c.public_slug} required />
                <input
                  className={field}
                  minLength={20}
                  name="reason"
                  placeholder="Irreversible purge reason"
                  required
                />
                <Button type="submit">Request purge</Button>
              </form>
            ))}
        </Card>
      ) : null}
      <div className="grid gap-4">
        {purges.map((p) => (
          <Card key={p.id} title={`Purge request · ${p.status}`}>
            <p className="text-sm text-[var(--text-secondary)]">{p.reason}</p>
            {canPurge && p.status === 'requested' ? (
              <form action={approvePurge} className="mt-3 grid gap-2 md:grid-cols-3">
                <input name="purgeRequestId" type="hidden" value={p.id} />
                <input className={field} name="confirmation" placeholder="Tenant slug" required />
                <input
                  className={field}
                  minLength={20}
                  name="reason"
                  placeholder="Independent approval rationale"
                  required
                />
                <Button type="submit">Approve request</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
