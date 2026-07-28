import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { RecordList, RecordListItem } from '@petcare/ui/record-list';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
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
      <PageHeader
        description="Itemized balances and posted payment history from the Roventra ledger."
        eyebrow="Finance"
        title="Invoices"
      />
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
      <CommandBar
        description="Narrow the ledger by invoice lifecycle state."
        title="Filter invoices"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField defaultValue={status} density="compact" label="Status" name="status">
            <option value="outstanding">Outstanding</option>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      <Card
        description="Balances are derived from immutable invoice versions and successful allocations."
        eyebrow="Billing records"
        title="Invoice ledger"
      >
        {invoices?.length ? (
          <RecordList>
            {invoices.map((invoice) => {
              const customer = invoice.customers as unknown as {
                first_name: string;
                last_name: string;
              } | null;
              const booking = invoice.bookings as unknown as { booking_number: string } | null;
              const balance = balanceByInvoice.get(invoice.id);
              return (
                <RecordListItem
                  action={
                    <ButtonLink
                      href={`/app/invoices/${invoice.id}`}
                      leadingIcon={<Icon name="arrow-right" />}
                      variant="secondary"
                    >
                      View invoice
                    </ButtonLink>
                  }
                  description={
                    <>
                      {booking?.booking_number ?? 'No booking'} ·{' '}
                      {money(balance?.paid_minor ?? 0, invoice.currency_code)} paid of{' '}
                      {money(balance?.total_minor ?? 0, invoice.currency_code)}
                    </>
                  }
                  key={invoice.id}
                  status={
                    <div className="flex flex-wrap items-center gap-3">
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
                      <span className="text-sm font-bold">
                        {money(balance?.balance_due_minor ?? 0, invoice.currency_code)} due
                      </span>
                    </div>
                  }
                  title={
                    <>
                      {invoice.invoice_number} · {customer?.first_name} {customer?.last_name}
                    </>
                  }
                />
              );
            })}
          </RecordList>
        ) : (
          <StatePanel
            action={
              <ButtonLink
                href="/app/bookings"
                leadingIcon={<Icon name="arrow-right" />}
                variant="secondary"
              >
                View bookings
              </ButtonLink>
            }
            description="Adjust the filter or issue an invoice from a booking."
            size="compact"
            title="No invoices match this view"
          />
        )}
      </Card>
    </div>
  );
}
