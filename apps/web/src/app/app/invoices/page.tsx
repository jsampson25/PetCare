import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function InvoicesPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.view')) redirect('/denied');
  const parameters = await searchParams;
  const status = typeof parameters.status === 'string' ? parameters.status : 'outstanding';
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('invoices')
    .select(
      'id,invoice_number,status,currency_code,issued_at,due_at,customers(first_name,last_name),bookings(booking_number),locations(name)',
    )
    .eq('business_id', context.businessId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status === 'outstanding') query = query.in('status', ['open', 'partially_paid']);
  else if (status !== 'all') query = query.eq('status', status);
  const { data: invoices } = await query;
  const { data: balances } = await supabase
    .from('invoice_balances')
    .select('invoice_id,total_minor,paid_minor,balance_due_minor,deposit_due_minor')
    .eq('business_id', context.businessId);
  const balanceByInvoice = new Map(
    (balances ?? []).map((balance) => [balance.invoice_id, balance]),
  );
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Finance</p>
        <h1 className="text-3xl font-black tracking-tight">Invoices</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Itemized balances and posted payment history from the PetCare ledger.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Invoice updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Invoice update failed" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <Card title="Filter invoices">
        <form method="get">
          <label className="text-sm font-bold">
            Status{' '}
            <select
              className="ml-2 min-h-11 rounded-lg border bg-white px-3"
              defaultValue={status}
              name="status"
            >
              <option value="outstanding">Outstanding</option>
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </label>
          <button
            className="ml-3 min-h-11 rounded-lg bg-[var(--action-primary)] px-5 text-sm font-bold text-[var(--action-primary-text)]"
            type="submit"
          >
            Apply
          </button>
        </form>
      </Card>
      <Card
        title="Invoice ledger"
        description="Balances are derived from immutable invoice versions and successful allocations."
      >
        {invoices?.length ? (
          <div className="divide-y">
            {invoices.map((invoice) => {
              const customer = invoice.customers as unknown as {
                first_name: string;
                last_name: string;
              } | null;
              const booking = invoice.bookings as unknown as { booking_number: string } | null;
              const balance = balanceByInvoice.get(invoice.id);
              return (
                <a
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  href={`/app/invoices/${invoice.id}`}
                  key={invoice.id}
                >
                  <div>
                    <p className="font-black">
                      {invoice.invoice_number} · {customer?.first_name} {customer?.last_name}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {booking?.booking_number ?? 'No booking'} ·{' '}
                      {money(balance?.paid_minor ?? 0, invoice.currency_code)} paid of{' '}
                      {money(balance?.total_minor ?? 0, invoice.currency_code)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      tone={
                        invoice.status === 'paid'
                          ? 'success'
                          : invoice.status === 'partially_paid'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {invoice.status.replaceAll('_', ' ')}
                    </Badge>
                    <p className="mt-1 text-sm font-bold">
                      {money(balance?.balance_due_minor ?? 0, invoice.currency_code)} due
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No invoices match this view. Issue one from a booking.
          </p>
        )}
      </Card>
    </div>
  );
}
