import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Summary = {
  currency_code: string;
  definition_version: number;
  financial: null | Record<string, number>;
  freshness: { as_of: string; status: string };
  operational: null | Record<string, number>;
  period: { end: string; start: string; time_basis: string };
  run_id: string;
};

const metricLabels: Record<string, string> = {
  booking_requests: 'Booking requests',
  cancelled_bookings: 'Cancelled bookings',
  collected_cash_minor: 'Collected cash',
  completed_bookings: 'Completed bookings',
  confirmed_bookings: 'Confirmed bookings',
  net_invoiced_minor: 'Net invoiced charges',
  open_operational_alerts: 'Open care alerts',
  outstanding_balance_minor: 'Outstanding balance',
  pets_currently_in_care: 'Pets currently in care',
  refunded_cash_minor: 'Refunded cash',
};

function validDate(value: string | string[] | undefined, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

function inputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100);
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveBusinessContext();
  if (!context) return null;
  const query = await searchParams;
  const defaultEnd = new Date();
  defaultEnd.setUTCHours(0, 0, 0, 0);
  defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 1);
  const defaultStart = new Date(defaultEnd);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 30);
  const start = validDate(query.start, defaultStart);
  const endDay = validDate(query.end, new Date(defaultEnd.valueOf() - 86_400_000));
  const end = new Date(endDay);
  end.setUTCDate(end.getUTCDate() + 1);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_business_summary_report', {
    target_business_id: context.businessId,
    period_start_value: start.toISOString(),
    period_end_value: end.toISOString(),
  });
  const summary = data as Summary | null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Business intelligence</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Reconciled operational and cash measures with explicit definitions and freshness.
        </p>
      </header>
      <Card title="Reporting period">
        <form className="flex flex-wrap items-end gap-4" method="get">
          <label className="grid gap-1 text-sm font-semibold">
            Start date
            <input
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={inputDate(start)}
              name="start"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            End date
            <input
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={inputDate(endDay)}
              name="end"
              type="date"
            />
          </label>
          <Button type="submit">Apply dates</Button>
        </form>
      </Card>
      <div className="flex flex-wrap gap-3">
        <ButtonLink
          href={`/app/reports/bookings?start=${inputDate(start)}&end=${inputDate(endDay)}`}
        >
          View booking activity
        </ButtonLink>
        <ButtonLink
          href={`/app/reports/occupancy?start=${inputDate(start)}&end=${inputDate(endDay)}`}
          variant="secondary"
        >
          View occupancy
        </ButtonLink>
        {context.permissions.has('reports.view_financial') ? (
          <ButtonLink
            href={`/app/reports/financial?start=${inputDate(start)}&end=${inputDate(endDay)}`}
            variant="secondary"
          >
            View financial reconciliation
          </ButtonLink>
        ) : null}
      </div>
      {error || !summary ? (
        <Alert title="Report unavailable" tone="danger">
          The report could not be generated for this scope. Check your dates and permissions.
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Badge tone="success">{summary.freshness.status}</Badge>
            <span>As of {new Date(summary.freshness.as_of).toLocaleString()}</span>
            <span>Time basis: {summary.period.time_basis}</span>
            <span>Definition v{summary.definition_version}</span>
          </div>
          {summary.operational ? (
            <section aria-labelledby="operational-heading" className="space-y-3">
              <h2 className="text-xl font-bold" id="operational-heading">
                Operations
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(summary.operational).map(([key, value]) => (
                  <Card key={key}>
                    <p className="text-3xl font-bold tabular-nums">{value}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {metricLabels[key] ?? key}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
          {summary.financial ? (
            <section aria-labelledby="financial-heading" className="space-y-3">
              <div>
                <h2 className="text-xl font-bold" id="financial-heading">
                  Financial activity
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Cash and invoice measures are distinct; these are not accounting revenue or
                  processor settlement.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(summary.financial).map(([key, value]) => (
                  <Card key={key}>
                    <p className="text-2xl font-bold tabular-nums">
                      {money(value, summary.currency_code)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {metricLabels[key] ?? key}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
          <details className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold">Metric definitions</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--text-secondary)]">
              <li>
                Booking requests use creation time; confirmed bookings use scheduled service start.
              </li>
              <li>
                Net invoiced charges use issued, non-void invoice snapshots in the selected period.
              </li>
              <li>
                Collected and refunded cash use successful transaction timestamps in the selected
                period.
              </li>
              <li>
                Outstanding balance is an as-of measure across authorized non-void, collectible
                invoices.
              </li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
