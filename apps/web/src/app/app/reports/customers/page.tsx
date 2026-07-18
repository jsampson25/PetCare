import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ServiceRow = {
  category: string;
  completed_bookings: number;
  completed_items: number;
  distinct_customers: number;
  service_name: string;
};
type CustomerReport = {
  definition_version: number;
  definitions: Record<string, string>;
  freshness: { as_of: string; status: string };
  period: { completion_basis: string; time_basis: string };
  service_mix: ServiceRow[];
  summary: {
    completed_bookings: number;
    customers_with_completed_booking: number;
    first_time_completed_customers: number;
    repeat_customer_rate_percent: number;
    returning_completed_customers: number;
  };
};
function dateValue(value: string | string[] | undefined, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

export default async function CustomerServiceReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await resolveBusinessContext();
  if (!context) return null;
  const query = await searchParams;
  const fallbackEnd = new Date();
  fallbackEnd.setUTCHours(0, 0, 0, 0);
  const fallbackStart = new Date(fallbackEnd);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 90);
  const start = dateValue(query.start, fallbackStart);
  const endDay = dateValue(query.end, fallbackEnd);
  const end = new Date(endDay);
  end.setUTCDate(end.getUTCDate() + 1);
  const startText = start.toISOString().slice(0, 10);
  const endText = endDay.toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_customer_service_mix_report', {
    target_business_id: context.businessId,
    period_start_value: start.toISOString(),
    period_end_value: end.toISOString(),
  });
  const report = data as CustomerReport | null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">
          Reports / Customers and services
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Customer return and service mix</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Completed-customer cohorts and completed service volume using authorized operational
          records.
        </p>
      </header>
      <Card title="Completion period">
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
        <Alert title="Customer report unavailable" tone="danger">
          The report could not be generated for this period and access scope.
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-3xl font-bold tabular-nums">{report.summary.completed_bookings}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Completed bookings</p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">
                {report.summary.first_time_completed_customers}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                First-time completed customers
              </p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">
                {report.summary.returning_completed_customers}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Returning completed customers
              </p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">
                {Number(report.summary.repeat_customer_rate_percent).toFixed(1)}%
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Repeat-customer rate</p>
            </Card>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Badge tone="success">{report.freshness.status}</Badge>
            <span>As of {new Date(report.freshness.as_of).toLocaleString()}</span>
            <span>
              {report.period.time_basis} · Completed-state basis · Definition v
              {report.definition_version}
            </span>
          </div>
          <section className="space-y-3">
            <h2 className="text-xl font-bold">Completed service mix</h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[var(--surface-subtle)]">
                  <tr>
                    {['Category', 'Service', 'Completed items', 'Bookings', 'Customers'].map(
                      (label) => (
                        <th className="px-4 py-3 font-bold" key={label}>
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.service_mix.map((row) => (
                    <tr
                      className="border-t border-[var(--border)]"
                      key={`${row.category}-${row.service_name}`}
                    >
                      <td className="px-4 py-3 capitalize">{row.category.replaceAll('_', ' ')}</td>
                      <td className="px-4 py-3 font-bold">{row.service_name}</td>
                      <td className="px-4 py-3 tabular-nums">{row.completed_items}</td>
                      <td className="px-4 py-3 tabular-nums">{row.completed_bookings}</td>
                      <td className="px-4 py-3 tabular-nums">{row.distinct_customers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.service_mix.length === 0 ? (
                <p className="p-6 text-center text-[var(--text-secondary)]">
                  No completed service items match this period.
                </p>
              ) : null}
            </div>
          </section>
          <Alert title="Cohort interpretation" tone="info">
            A returning customer must have an authorized completed booking before this period.
            Requests, cancellations, and future confirmations do not count as completed retention.
          </Alert>
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
