import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

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
  const [eventResult, tenantResult] = await Promise.all([
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
  ]);
  const events = (eventResult.data ?? []) as AuditEvent[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
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
