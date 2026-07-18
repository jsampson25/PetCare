import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { notFound, redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { issueRefund, recordManualPayment, startOnlinePayment } from '../actions';

type PageParameters = Promise<{ invoiceId: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: PageParameters;
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.view')) redirect('/denied');
  const { invoiceId } = await params;
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id,invoice_number,status,currency_code,location_id,issued_at,due_at,customers(first_name,last_name,email),bookings(id,booking_number),locations(name)',
    )
    .eq('business_id', context.businessId)
    .eq('id', invoiceId)
    .single();
  if (!invoice) notFound();
  const [
    { data: versions },
    { data: payments },
    { data: receipts },
    { data: refunds },
    { data: refundReceipts },
    { data: balance },
  ] = await Promise.all([
    supabase
      .from('invoice_versions')
      .select(
        'id,version_number,subtotal_minor,discount_minor,fee_minor,tax_minor,total_minor,deposit_required_minor,invoice_lines(id,line_type,label,quantity,unit_amount_minor,total_minor,display_order)',
      )
      .eq('business_id', context.businessId)
      .eq('invoice_id', invoiceId)
      .order('version_number', { ascending: false }),
    supabase
      .from('payments')
      .select('id,amount_minor,tender_type,status,provider,manual_reference,collected_at')
      .eq('business_id', context.businessId)
      .eq('invoice_id', invoiceId)
      .order('collected_at', { ascending: false }),
    supabase
      .from('receipts')
      .select('id,receipt_number,amount_minor,issued_at')
      .eq('business_id', context.businessId)
      .eq('invoice_id', invoiceId)
      .order('issued_at', { ascending: false }),
    supabase
      .from('refunds')
      .select('id,payment_id,amount_minor,reason,refunded_at')
      .eq('business_id', context.businessId)
      .eq('invoice_id', invoiceId)
      .order('refunded_at', { ascending: false }),
    supabase
      .from('refund_receipts')
      .select('id,receipt_number,amount_minor,issued_at')
      .eq('business_id', context.businessId)
      .eq('invoice_id', invoiceId)
      .order('issued_at', { ascending: false }),
    supabase
      .from('invoice_balances')
      .select(
        'total_minor,credit_minor,net_total_minor,refunded_minor,paid_minor,balance_due_minor,deposit_due_minor,deposit_required_minor',
      )
      .eq('business_id', context.businessId)
      .eq('invoice_id', invoiceId)
      .single(),
  ]);
  const customer = invoice.customers as unknown as {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  const booking = invoice.bookings as unknown as { id: string; booking_number: string } | null;
  const location = invoice.locations as unknown as { name: string } | null;
  const current = versions?.[0];
  const lines = (
    (current?.invoice_lines ?? []) as unknown as {
      id: string;
      line_type: string;
      label: string;
      quantity: number;
      unit_amount_minor: number;
      total_minor: number;
      display_order: number;
    }[]
  ).sort((a, b) => a.display_order - b.display_order);
  const money = (minor: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency_code }).format(
      minor / 100,
    );
  const refundedByPayment = new Map<string, number>();
  for (const refund of refunds ?? [])
    refundedByPayment.set(
      refund.payment_id,
      (refundedByPayment.get(refund.payment_id) ?? 0) + refund.amount_minor,
    );
  const { data: merchant } = await supabase
    .from('merchant_accounts')
    .select('status,charges_enabled')
    .eq('business_id', context.businessId)
    .maybeSingle();
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">
          {location?.name} · {booking?.booking_number ?? 'Standalone'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight">{invoice.invoice_number}</h1>
          <Badge tone={invoice.status === 'paid' ? 'success' : 'warning'}>
            {invoice.status.replaceAll('_', ' ')}
          </Badge>
        </div>
        <p className="mt-2 text-[var(--text-secondary)]">
          {customer?.first_name} {customer?.last_name} · {customer?.email}
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Financial update complete" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Financial action unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <section className="grid gap-5 md:grid-cols-3">
        <Card title={money(balance?.total_minor ?? 0)} description="Invoice total">
          <p className="text-sm">
            Credits: {money(balance?.credit_minor ?? 0)} · net total:{' '}
            {money(balance?.net_total_minor ?? balance?.total_minor ?? 0)}
          </p>
        </Card>
        <Card title={money(balance?.paid_minor ?? 0)} description="Successfully allocated">
          <p className="text-sm">
            Refunded: {money(balance?.refunded_minor ?? 0)} · deposit still due:{' '}
            {money(balance?.deposit_due_minor ?? 0)}
          </p>
        </Card>
        <Card title={money(balance?.balance_due_minor ?? 0)} description="Balance due">
          <p className="text-sm">Status: {invoice.status.replaceAll('_', ' ')}</p>
        </Card>
      </section>
      <Card title="Itemized charges">
        {lines.map((line) => (
          <div className="flex justify-between gap-4 border-b py-3 last:border-0" key={line.id}>
            <div>
              <p className="font-bold">{line.label}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {line.line_type} · quantity {line.quantity}
              </p>
            </div>
            <p className="font-bold">{money(line.total_minor)}</p>
          </div>
        ))}
      </Card>
      {balance?.balance_due_minor && context.permissions.has('payments.collect') ? (
        <Card
          title="Pay securely online"
          description="Card details are collected only on Stripe's hosted checkout page."
        >
          {merchant?.status === 'active' && merchant.charges_enabled ? (
            <form action={startOnlinePayment} className="flex flex-wrap items-end gap-4">
              <input name="invoiceId" type="hidden" value={invoice.id} />
              <Field
                label="Online payment amount"
                name="amount"
                type="number"
                min="0.01"
                max={(balance.balance_due_minor / 100).toFixed(2)}
                step="0.01"
                defaultValue={(
                  (balance.deposit_due_minor > 0
                    ? balance.deposit_due_minor
                    : balance.balance_due_minor) / 100
                ).toFixed(2)}
                required
              />
              <Button type="submit">Continue to Stripe</Button>
            </form>
          ) : (
            <Alert title="Online payment unavailable" tone="warning">
              Finish Stripe merchant onboarding before collecting cards online.
            </Alert>
          )}
        </Card>
      ) : null}
      {balance?.balance_due_minor && context.permissions.has('payments.collect') ? (
        <Card
          title="Record manual tender"
          description="Cash, check, and externally verified card payments only. Never enter card numbers here."
        >
          <form action={recordManualPayment} className="grid gap-4 md:grid-cols-3">
            <input name="invoiceId" type="hidden" value={invoice.id} />
            <input name="locationId" type="hidden" value={invoice.location_id} />
            <Field
              label="Amount"
              name="amount"
              type="number"
              min="0.01"
              max={(balance.balance_due_minor / 100).toFixed(2)}
              step="0.01"
              required
            />
            <label className="text-sm font-bold">
              Tender
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="tender"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="external_card">External card terminal</option>
              </select>
            </label>
            <Field label="Check/terminal reference" name="reference" />
            <div>
              <Button type="submit">Post payment</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card title="Payment history">
        {payments?.length ? (
          <div className="divide-y">
            {payments.map((payment) => (
              <div className="flex justify-between gap-3 py-3" key={payment.id}>
                <div>
                  <p className="font-bold">{payment.tender_type.replaceAll('_', ' ')}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(payment.collected_at))}{' '}
                    · {payment.manual_reference ?? 'No reference'}
                  </p>
                </div>
                <p className="font-bold">{money(payment.amount_minor)}</p>
                {context.permissions.has('payments.refund') &&
                payment.status === 'succeeded' &&
                payment.amount_minor - (refundedByPayment.get(payment.id) ?? 0) > 0 ? (
                  <form action={issueRefund} className="mt-3 grid gap-2 sm:grid-cols-3">
                    <input name="invoiceId" type="hidden" value={invoice.id} />
                    <input name="paymentId" type="hidden" value={payment.id} />
                    <input name="requestKey" type="hidden" value={crypto.randomUUID()} />
                    <Field
                      label="Refund amount"
                      name="amount"
                      type="number"
                      min="0.01"
                      max={(
                        (payment.amount_minor - (refundedByPayment.get(payment.id) ?? 0)) /
                        100
                      ).toFixed(2)}
                      step="0.01"
                      required
                    />
                    <Field label="Reason" name="reason" minLength={5} required />
                    <label className="flex items-center gap-2 text-sm font-bold sm:col-span-3">
                      <input name="confirmed" type="checkbox" value="true" required />I confirm this
                      money should be returned. Manual tenders have already been returned outside
                      PetCare.
                    </label>
                    <div className="sm:col-span-3">
                      <Button type="submit" variant="secondary">
                        Issue refund
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No payments posted.</p>
        )}
      </Card>
      <Card title="Refund history">
        {refunds?.length ? (
          <div className="divide-y">
            {refunds.map((refund) => (
              <div className="flex justify-between gap-3 py-3" key={refund.id}>
                <div>
                  <p className="font-bold">{refund.reason}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                      new Date(refund.refunded_at),
                    )}
                  </p>
                </div>
                <p className="font-bold">-{money(refund.amount_minor)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No refunds issued.</p>
        )}
      </Card>
      <Card title="Receipts">
        {(receipts?.length ?? 0) + (refundReceipts?.length ?? 0) > 0 ? (
          <ul>
            {(receipts ?? []).map((receipt) => (
              <li className="py-2" key={receipt.id}>
                {receipt.receipt_number} · {money(receipt.amount_minor)}
              </li>
            ))}
            {refundReceipts?.map((receipt) => (
              <li className="py-2" key={receipt.id}>
                {receipt.receipt_number} · refund {money(receipt.amount_minor)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No receipts issued.</p>
        )}
      </Card>
    </div>
  );
}
