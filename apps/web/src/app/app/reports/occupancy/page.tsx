import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type OccupancyRow = {
  local_date: string;
  location_name: string;
  occupancy_rate_percent: number;
  occupied_resource_hours: number;
  pool_name: string;
  sellable_resource_hours: number;
  sellable_units: number;
  service_name: string;
  time_zone: string;
};
type OccupancyReport = {
  definition_version: number;
  definitions: Record<string, string>;
  freshness: { as_of: string; status: string };
  period: { day_basis: string };
  rows: OccupancyRow[];
};
function dateValue(value: string | string[] | undefined, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

export default async function OccupancyPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveBusinessContext();
  if (!context) return null;
  const query = await searchParams;
  const fallbackEnd = new Date();
  fallbackEnd.setUTCHours(0, 0, 0, 0);
  const fallbackStart = new Date(fallbackEnd);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 13);
  const start = dateValue(query.start, fallbackStart);
  const end = dateValue(query.end, fallbackEnd);
  const startText = start.toISOString().slice(0, 10);
  const endText = end.toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_capacity_utilization_report', {
    target_business_id: context.businessId,
    start_date_value: startText,
    end_date_value: endText,
  });
  const report = data as OccupancyReport | null;
  const totals = (report?.rows ?? []).reduce(
    (sum, row) => ({
      occupied: sum.occupied + Number(row.occupied_resource_hours),
      sellable: sum.sellable + Number(row.sellable_resource_hours),
    }),
    { occupied: 0, sellable: 0 },
  );
  const rate = totals.sellable ? (totals.occupied / totals.sellable) * 100 : 0;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Reports / Occupancy</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Capacity utilization</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Time-weighted occupancy using matching resource-hour numerator and denominator.
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
        <Alert title="Occupancy report unavailable" tone="danger">
          The report could not be generated for this period and access scope.
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-3xl font-bold tabular-nums">{rate.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Weighted occupancy rate</p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">{totals.occupied.toFixed(1)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Occupied resource-hours</p>
            </Card>
            <Card>
              <p className="text-3xl font-bold tabular-nums">{totals.sellable.toFixed(1)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Sellable resource-hours</p>
            </Card>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Badge tone="success">{report.freshness.status}</Badge>
            <span>As of {new Date(report.freshness.as_of).toLocaleString()}</span>
            <span>Local-day basis · Definition v{report.definition_version}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[var(--surface-subtle)]">
                <tr>
                  {[
                    'Date',
                    'Location',
                    'Service / pool',
                    'Sellable units',
                    'Occupied hours',
                    'Sellable hours',
                    'Occupancy',
                  ].map((label) => (
                    <th className="px-4 py-3 font-bold" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    className="border-t border-[var(--border)]"
                    key={`${row.local_date}-${row.location_name}-${row.pool_name}`}
                  >
                    <td className="px-4 py-3">{row.local_date}</td>
                    <td className="px-4 py-3">
                      {row.location_name}
                      <span className="block text-xs text-[var(--text-secondary)]">
                        {row.time_zone}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.service_name}
                      <span className="block text-xs text-[var(--text-secondary)]">
                        {row.pool_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.sellable_units}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(row.occupied_resource_hours).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(row.sellable_resource_hours).toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={Number(row.occupancy_rate_percent) >= 90 ? 'warning' : 'info'}>
                        {Number(row.occupancy_rate_percent).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length === 0 ? (
              <p className="p-6 text-center text-[var(--text-secondary)]">
                No active capacity pools match this period.
              </p>
            ) : null}
          </div>
          <details className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold">Metric definitions</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--text-secondary)]">
              {Object.values(report.definitions).map((definition) => (
                <li key={definition}>{definition}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
