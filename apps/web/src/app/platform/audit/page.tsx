import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { approveAuditExport, requestAuditExport } from './actions';

type AuditEvent = {
  actor_id: string | null;
  business_name: string | null;
  case_key: string | null;
  event_id: string;
  event_type: string;
  occurred_at: string;
  risk: 'critical' | 'high' | 'moderate';
  summary: string;
};
type Tenant = { business_id: string; name: string };
type AuditExport = {
  business_name: string | null;
  download_count: number;
  expires_at: string;
  occurred_from: string;
  occurred_to: string;
  purpose: string;
  request_id: string;
  result_limit: number;
  status: 'approved' | 'expired' | 'requested' | 'revoked';
};
type Search = {
  actor?: string;
  business?: string;
  case?: string;
  event?: string;
  from?: string;
  to?: string;
};

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const search = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [eventResult, tenantResult, exportResult] = await Promise.all([
    supabase.rpc('search_platform_audit_events', {
      target_business_id: search.business || null,
      target_actor_id: search.actor || null,
      event_query: search.event || null,
      case_key_query: search.case || null,
      occurred_from: search.from ? new Date(search.from).toISOString() : null,
      occurred_to: search.to ? new Date(search.to).toISOString() : null,
      result_limit: 100,
    }),
    supabase.rpc('list_platform_tenants'),
    context.permissions.has('platform.audit.export')
      ? supabase.rpc('list_platform_audit_export_requests')
      : Promise.resolve({ data: [], error: null }),
  ]);
  const events = (eventResult.data ?? []) as AuditEvent[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const exports = (exportResult.data ?? []) as AuditExport[];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform assurance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Administrative audit</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Bounded search across tenant, subscription, feature, support, job, privacy, and health
          controls.
        </p>
      </header>
      <Card title="Search events">
        <form className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            Tenant
            <select
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={search.business ?? ''}
              name="business"
            >
              <option value="">All approved tenants</option>
              {tenants.map((tenant) => (
                <option key={tenant.business_id} value={tenant.business_id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Event contains
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2"
              defaultValue={search.event}
              name="event"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Case or correlation key
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2"
              defaultValue={search.case}
              name="case"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Actor ID
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2"
              defaultValue={search.actor}
              name="actor"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            From
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2"
              defaultValue={search.from}
              name="from"
              type="datetime-local"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            To
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2"
              defaultValue={search.to}
              name="to"
              type="datetime-local"
            />
          </label>
          <div>
            <button
              className="rounded-lg bg-[var(--action-primary)] px-4 py-2 font-bold text-white"
              type="submit"
            >
              Search audit
            </button>
          </div>
        </form>
      </Card>
      {context.permissions.has('platform.audit.export') ? (
        <Card title="Request a protected CSV export">
          <form action={requestAuditExport} className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              Tenant
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="businessId"
              >
                <option value="">All approved tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.business_id} value={tenant.business_id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              From
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="from"
                type="datetime-local"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              To
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="to"
                type="datetime-local"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Event contains
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="eventQuery"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Case key
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="caseKey"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Actor ID
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="actorId"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Maximum rows
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                defaultValue={100}
                max={250}
                min={1}
                name="resultLimit"
                type="number"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Link expires
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="expiresAt"
                type="datetime-local"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-3">
              Purpose
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="purpose"
                required
              />
            </label>
            <div>
              <Button type="submit">Request export</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {exports.length ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-bold">Protected exports</h2>
          {exports.map((item) => (
            <Card key={item.request_id} title={item.purpose}>
              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    item.status === 'approved'
                      ? 'success'
                      : item.status === 'expired'
                        ? 'danger'
                        : 'info'
                  }
                >
                  {item.status}
                </Badge>
                <span className="text-sm text-[var(--text-secondary)]">
                  {item.business_name ?? 'Platform-wide'} · {item.result_limit} rows maximum ·
                  expires {new Date(item.expires_at).toLocaleString()} · {item.download_count}{' '}
                  download(s)
                </span>
              </div>
              {item.status === 'requested' ? (
                <form action={approveAuditExport} className="mt-4 flex flex-wrap items-end gap-3">
                  <input name="requestId" type="hidden" value={item.request_id} />
                  <label className="grid flex-1 gap-1 text-sm font-semibold">
                    Approval reason
                    <input
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      minLength={12}
                      name="reason"
                      required
                    />
                  </label>
                  <Button type="submit" variant="secondary">
                    Approve export
                  </Button>
                </form>
              ) : null}
              {item.status === 'approved' ? (
                <a
                  className="mt-4 inline-block font-semibold text-[var(--action-primary)] underline"
                  href={`/api/platform/audit-exports/${item.request_id}`}
                >
                  Download audited CSV
                </a>
              ) : null}
            </Card>
          ))}
        </section>
      ) : null}
      {eventResult.error || tenantResult.error ? (
        <Alert title="Audit search unavailable" tone="danger">
          Filters must be valid and bounded. No audit data was returned.
        </Alert>
      ) : null}
      {!eventResult.error && events.length === 0 ? (
        <Alert title="No matching events" tone="info">
          Adjust the approved filters or time range.
        </Alert>
      ) : null}
      <div className="grid gap-4">
        {events.map((event) => (
          <Card key={`${event.event_type}-${event.event_id}`} title={event.event_type}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  event.risk === 'critical' ? 'danger' : event.risk === 'high' ? 'warning' : 'info'
                }
              >
                {event.risk}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                {event.business_name ?? 'Platform-wide'} ·{' '}
                {new Date(event.occurred_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-3 text-sm">{event.summary}</p>
            {event.case_key ? <p className="mt-2 font-mono text-xs">{event.case_key}</p> : null}
            <p className="mt-2 font-mono text-xs text-[var(--text-secondary)]">
              Actor {event.actor_id ?? 'system'}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
