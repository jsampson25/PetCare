import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { PortalPageHeader } from '../_components/portal-page-header';

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100);

export default async function BillingPage() {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  const due = dashboard.invoices.reduce((sum, invoice) => sum + invoice.balance_due_minor, 0);
  const paid = dashboard.invoices.reduce(
    (sum, invoice) => sum + invoice.total_minor - invoice.balance_due_minor,
    0,
  );
  const currency = dashboard.invoices[0]?.currency_code ?? 'USD';
  return (
    <div className="space-y-6">
      <PortalPageHeader
        description="Review issued invoices, paid amounts, and anything still due."
        eyebrow="Payments & receipts"
        title="Billing"
      />
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Billing summary">
        <div
          className={`rounded-2xl border p-5 ${due ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Current balance
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight">{money(due, currency)}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {due ? 'Across all open invoices' : 'Your account is paid in full'}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--elevation-1)]">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Recorded payments
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight">{money(paid, currency)}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Applied to the invoices shown below
          </p>
        </div>
      </section>
      {dashboard.invoices.length ? (
        <div className="grid gap-4">
          {dashboard.invoices.map((invoice) => (
            <Card className="!p-0" key={invoice.id}>
              <div className="grid items-center gap-4 p-5 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Invoice
                  </p>
                  <h2 className="mt-1 text-lg font-black">{invoice.invoice_number}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {invoice.issued_at
                      ? `Issued ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(invoice.issued_at))}`
                      : 'Not issued'}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Total
                  </p>
                  <p className="mt-1 font-black">
                    {money(invoice.total_minor, invoice.currency_code)}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {money(invoice.balance_due_minor, invoice.currency_code)} due
                  </p>
                </div>
                <Badge tone={invoice.balance_due_minor === 0 ? 'success' : 'warning'}>
                  {invoice.status.replaceAll('_', ' ')}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <StatePanel
          title="No invoices"
          description="Invoices and current balances will appear here."
        />
      )}
    </div>
  );
}
