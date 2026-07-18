import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TaskRow = {
  completed_count: number;
  due_count: number;
  exception_count: number;
  on_time_count: number;
  on_time_rate_percent: number;
  open_count: number;
  task_type: string;
};
type IncidentRow = { incident_count: number; severity: string; unresolved_count: number };
type CareReport = {
  definition_version: number;
  definitions: Record<string, string>;
  freshness: { as_of: string; status: string };
  incidents: IncidentRow[];
  period: { time_basis: string };
  summary: {
    due_tasks: number;
    exception_tasks: number;
    incident_count: number;
    on_time_rate_percent: number;
    open_alerts_as_of: number;
    open_tasks: number;
    report_cards_eligible: number;
    report_cards_published: number;
    serious_or_critical_incidents: number;
  };
  task_types: TaskRow[];
};
function dateValue(value: string | string[] | undefined, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

export default async function CareCompliancePage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveBusinessContext();
  if (!context) return null;
  const query = await searchParams;
  const fallbackEnd = new Date();
  fallbackEnd.setUTCHours(0, 0, 0, 0);
  const fallbackStart = new Date(fallbackEnd);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 30);
  const start = dateValue(query.start, fallbackStart);
  const endDay = dateValue(query.end, fallbackEnd);
  const end = new Date(endDay);
  end.setUTCDate(end.getUTCDate() + 1);
  const startText = start.toISOString().slice(0, 10);
  const endText = endDay.toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_care_compliance_report', {
    target_business_id: context.businessId,
    period_start_value: start.toISOString(),
    period_end_value: end.toISOString(),
  });
  const report = data as CareReport | null;
  const cardRate = report?.summary.report_cards_eligible
    ? (report.summary.report_cards_published / report.summary.report_cards_eligible) * 100
    : 0;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Reports / Care compliance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Care compliance and safety</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Task timing, care exceptions, incidents, alerts, and report-card delivery.
        </p>
      </header>
      <Card title="Reporting period">
        <form className="flex flex-wrap items-end gap-4" method="get">
          <label className="grid gap-1 text-sm font-semibold">
            Start date
            <input
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={startText}
              name="start"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            End date
            <input
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={endText}
              name="end"
              type="date"
            />
          </label>
          <Button type="submit">Apply dates</Button>
        </form>
      </Card>
      {error || !report ? (
        <Alert title="Care report unavailable" tone="danger">
          The report could not be generated for this period and access scope.
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-3xl font-bold tabular-nums">
                {Number(report.summary.on_time_rate_percent).toFixed(1)}%
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">On-time task rate</p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">{report.summary.exception_tasks}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Care exceptions</p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">
                {report.summary.serious_or_critical_incidents}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Serious / critical incidents
              </p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">{cardRate.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Report cards published</p>
            </Card>
          </div>
          {report.summary.open_alerts_as_of > 0 ? (
            <Alert
              title={`${report.summary.open_alerts_as_of} unresolved operational alert(s)`}
              tone="warning"
            >
              Open alerts are an as-of guardrail and remain visible regardless of the selected
              historical period.
            </Alert>
          ) : (
            <Alert title="No unresolved operational alerts" tone="success">
              No open or acknowledged care alert exists at the current watermark.
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Badge tone="success">{report.freshness.status}</Badge>
            <span>As of {new Date(report.freshness.as_of).toLocaleString()}</span>
            <span>
              {report.period.time_basis} · Definition v{report.definition_version}
            </span>
          </div>
          <section className="space-y-3">
            <h2 className="text-xl font-bold">Care tasks</h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--surface-subtle)]">
                  <tr>
                    {[
                      'Task type',
                      'Due',
                      'Completed',
                      'On time',
                      'Exceptions',
                      'Still open',
                      'On-time rate',
                    ].map((label) => (
                      <th className="px-4 py-3 font-bold" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.task_types.map((row) => (
                    <tr className="border-t border-[var(--border)]" key={row.task_type}>
                      <td className="px-4 py-3 font-bold capitalize">{row.task_type}</td>
                      <td className="px-4 py-3">{row.due_count}</td>
                      <td className="px-4 py-3">{row.completed_count}</td>
                      <td className="px-4 py-3">{row.on_time_count}</td>
                      <td className="px-4 py-3">{row.exception_count}</td>
                      <td className="px-4 py-3">{row.open_count}</td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={Number(row.on_time_rate_percent) >= 90 ? 'success' : 'warning'}
                        >
                          {Number(row.on_time_rate_percent).toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.task_types.length === 0 ? (
                <p className="p-6 text-center text-[var(--text-secondary)]">
                  No eligible care tasks match this period.
                </p>
              ) : null}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold">Incidents by severity</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {report.incidents.map((row) => (
                <Card key={row.severity}>
                  <p className="text-2xl font-bold tabular-nums">{row.incident_count}</p>
                  <p className="mt-1 capitalize text-[var(--text-secondary)]">{row.severity}</p>
                  <p className="mt-2 text-sm">{row.unresolved_count} unresolved</p>
                </Card>
              ))}
              {report.incidents.length === 0 ? (
                <Card>
                  <p className="font-bold">No incidents in this period</p>
                </Card>
              ) : null}
            </div>
          </section>
          <details className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold">Metric definitions</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--text-secondary)]">
              {Object.values(report.definitions).map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
