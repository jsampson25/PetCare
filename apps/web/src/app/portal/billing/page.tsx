import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
export default async function BillingPage() {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Account</p>
        <h1 className="mt-2 text-3xl font-black">Billing</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Issued invoices and their current payment balances.
        </p>
      </header>
      {d.invoices.length ? (
        <div className="grid gap-5">
          {d.invoices.map((invoice) => (
            <Card
              key={invoice.id}
              title={invoice.invoice_number}
              description={
                invoice.issued_at
                  ? `Issued ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(invoice.issued_at))}`
                  : 'Not issued'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-black">
                    {invoice.currency_code} ${(invoice.total_minor / 100).toFixed(2)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Balance ${(invoice.balance_due_minor / 100).toFixed(2)}
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
