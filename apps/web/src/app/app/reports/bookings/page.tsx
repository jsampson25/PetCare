import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type BookingRow = {
  booking_number: string;
  booking_status: string;
  customer_name: string;
  ends_at: string;
  item_status: string;
  pet_name: string;
  service_name: string;
  source_channel: string;
  starts_at: string;
};
type ActivityReport = {
  definition_version: number;
  freshness: { as_of: string; status: string };
  period: { time_basis: string };
  row_count: number;
  rows: BookingRow[];
  truncated: boolean;
};

function dateValue(value: string | string[] | undefined, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

export default async function BookingActivityPage({
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
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 30);
  const start = dateValue(query.start, fallbackStart);
  const endDay = dateValue(query.end, fallbackEnd);
  const end = new Date(endDay);
  end.setUTCDate(end.getUTCDate() + 1);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_booking_activity_report', {
    export_value: false,
    period_end_value: end.toISOString(),
    period_start_value: start.toISOString(),
    target_business_id: context.businessId,
  });
  const report = data as ActivityReport | null;
  const params = new URLSearchParams({
    end: endDay.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10),
  });
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Reports / Booking activity</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Booking activity</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Authorized booking-item detail behind the summary metrics.
        </p>
      </header>
      <Card title="Reporting period">
        <form className="flex flex-wrap items-end gap-4" method="get">
          <label className="grid gap-1 text-sm font-semibold">
            Start date
            <input
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={params.get('start') ?? ''}
              name="start"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            End date
            <input
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              defaultValue={params.get('end') ?? ''}
              name="end"
              type="date"
            />
          </label>
          <Button type="submit">Apply dates</Button>
          {context.permissions.has('reports.export') ? (
            <ButtonLink href={`/api/reports/bookings.csv?${params}`} variant="secondary">
              Export CSV
            </ButtonLink>
          ) : null}
        </form>
      </Card>
      {error || !report ? (
        <Alert title="Report unavailable" tone="danger">
          The booking activity report could not be generated for this scope.
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Badge tone="success">{report.freshness.status}</Badge>
            <span>{report.row_count} row(s)</span>
            <span>As of {new Date(report.freshness.as_of).toLocaleString()}</span>
            <span>
              {report.period.time_basis} · Definition v{report.definition_version}
            </span>
          </div>
          {report.truncated ? (
            <Alert title="Result limited" tone="warning">
              The first 5,000 authorized rows are shown. Narrow the date range before exporting.
            </Alert>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--surface-subtle)]">
                <tr>
                  {[
                    'Booking',
                    'Customer',
                    'Pet',
                    'Service',
                    'Start',
                    'End',
                    'Status',
                    'Source',
                  ].map((label) => (
                    <th className="px-4 py-3 font-bold" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr
                    className="border-t border-[var(--border)]"
                    key={`${row.booking_number}-${row.pet_name}-${index}`}
                  >
                    <td className="px-4 py-3 font-bold">{row.booking_number}</td>
                    <td className="px-4 py-3">{row.customer_name}</td>
                    <td className="px-4 py-3">{row.pet_name}</td>
                    <td className="px-4 py-3">{row.service_name}</td>
                    <td className="px-4 py-3">{new Date(row.starts_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{new Date(row.ends_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge>{row.booking_status}</Badge>
                    </td>
                    <td className="px-4 py-3">{row.source_channel.replaceAll('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length === 0 ? (
              <p className="p-6 text-center text-[var(--text-secondary)]">
                No booking activity matches this period.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
