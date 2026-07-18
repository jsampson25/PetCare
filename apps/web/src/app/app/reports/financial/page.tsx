import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type FinancialRow = {
  collected_minor: number;
  credits_minor: number;
  currency_code: string;
  customer_name: string;
  due_at: string | null;
  invoice_number: string;
  invoice_status: string;
  invoiced_minor: number;
  issued_at: string;
  outstanding_minor: number;
  reconciliation_status: string;
  refunded_minor: number;
};
type FinancialReport = {
  currency_code: string;
  definition_version: number;
  definitions: Record<string, string>;
  freshness: { as_of: string; status: string };
  mixed_currency: boolean;
  period: { time_basis: string };
  rows: FinancialRow[];
  summary: {
    collected_minor: number;
    credits_minor: number;
    invoice_count: number;
    invoiced_minor: number;
    outstanding_minor: number;
    refunded_minor: number;
    review_required_count: number;
  };
};
function dateValue(value: string | string[] | undefined, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}
function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { currency, style: 'currency' }).format(
    Number(value) / 100,
  );
}

export default async function FinancialReportPage({
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
  const startText = start.toISOString().slice(0, 10);
  const endText = endDay.toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_financial_reconciliation_report', {
    target_business_id: context.businessId,
    period_start_value: start.toISOString(),
    period_end_value: end.toISOString(),
  });
  const report = data as FinancialReport | null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">
          Reports / Financial reconciliation
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Invoices and cash</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Invoice charges, collected allocations, refunds, credits, and balances shown separately.
        </p>
      </header>
      <Alert title="Operational financial view" tone="info">
        This report does not represent accounting revenue, bank settlement, tax filing, or a general
        ledger.
      </Alert>
      <Card title="Invoice-issued period">
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
        <Alert title="Financial report unavailable" tone="danger">
          The report could not be generated for this period and access scope.
        </Alert>
      ) : (
        <>
          {report.mixed_currency ? (
            <Alert title="Mixed currencies detected" tone="warning">
              Combined money totals are hidden. Narrow the report to one configured currency.
            </Alert>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Net invoiced', report.summary.invoiced_minor],
                ['Collected', report.summary.collected_minor],
                ['Refunded', report.summary.refunded_minor],
                ['Outstanding', report.summary.outstanding_minor],
              ].map(([label, value]) => (
                <Card key={label}>
                  <p className="text-2xl font-bold tabular-nums">
                    {money(Number(value), report.currency_code)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{label}</p>
                </Card>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Badge tone="success">{report.freshness.status}</Badge>
            <span>{report.summary.invoice_count} invoice(s)</span>
            <span>As of {new Date(report.freshness.as_of).toLocaleString()}</span>
            <span>
              {report.period.time_basis} · Definition v{report.definition_version}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-[var(--surface-subtle)]">
                <tr>
                  {[
                    'Invoice',
                    'Customer',
                    'Issued',
                    'Status',
                    'Invoiced',
                    'Credits',
                    'Collected',
                    'Refunded',
                    'Outstanding',
                    'Reconciliation',
                  ].map((label) => (
                    <th className="px-4 py-3 font-bold" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr className="border-t border-[var(--border)]" key={row.invoice_number}>
                    <td className="px-4 py-3 font-bold">{row.invoice_number}</td>
                    <td className="px-4 py-3">{row.customer_name}</td>
                    <td className="px-4 py-3">{new Date(row.issued_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{row.invoice_status.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(row.invoiced_minor, row.currency_code)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(row.credits_minor, row.currency_code)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(row.collected_minor, row.currency_code)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(row.refunded_minor, row.currency_code)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(row.outstanding_minor, row.currency_code)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.reconciliation_status === 'review_required'
                            ? 'warning'
                            : row.reconciliation_status === 'reconciled'
                              ? 'success'
                              : 'info'
                        }
                      >
                        {row.reconciliation_status.replaceAll('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length === 0 ? (
              <p className="p-6 text-center text-[var(--text-secondary)]">
                No issued invoices match this period.
              </p>
            ) : null}
          </div>
          <details className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold">Metric definitions</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--text-secondary)]">
              {Object.entries(report.definitions).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
