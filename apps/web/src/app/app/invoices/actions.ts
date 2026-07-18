'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createInvoiceCheckoutSession } from '../../../lib/payments/stripe-api';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const paymentSchema = z.object({
  amount: z.coerce.number().positive().multipleOf(0.01).max(1_000_000),
  invoiceId: z.uuid(),
  locationId: z.uuid(),
  reference: z.string().trim().max(120).optional(),
  tender: z.enum(['cash', 'check', 'external_card']),
});

export async function recordManualPayment(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.collect')) redirect('/denied');
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/invoices?error=Check+the+payment+details.');
  const amountMinor = Math.round(parsed.data.amount * 100);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_manual_payment', {
    amount_value: amountMinor,
    reference_value: parsed.data.reference || '',
    request_key: `manual-payment-${crypto.randomUUID()}`,
    target_business_id: context.businessId,
    target_invoice_id: parsed.data.invoiceId,
    target_location_id: parsed.data.locationId,
    tender_value: parsed.data.tender,
  });
  if (error)
    redirect(`/app/invoices/${parsed.data.invoiceId}?error=Payment+could+not+be+recorded.`);
  redirect(`/app/invoices/${parsed.data.invoiceId}?notice=Payment+and+receipt+recorded.`);
}

const onlineSchema = z.object({
  amount: z.coerce.number().positive().multipleOf(0.01).max(1_000_000),
  invoiceId: z.uuid(),
});
export async function startOnlinePayment(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.collect')) redirect('/denied');
  const parsed = onlineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/invoices?error=Check+the+online+payment+amount.');
  const supabase = await createSupabaseServerClient();
  const [{ data: invoice }, { data: merchant }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id,invoice_number,currency_code')
      .eq('business_id', context.businessId)
      .eq('id', parsed.data.invoiceId)
      .single(),
    supabase
      .from('merchant_accounts')
      .select('provider_account_id,status,charges_enabled')
      .eq('business_id', context.businessId)
      .maybeSingle(),
  ]);
  if (!invoice || merchant?.status !== 'active' || !merchant.charges_enabled)
    redirect(`/app/invoices/${parsed.data.invoiceId}?error=Online+payments+are+not+active.`);
  const amountMinor = Math.round(parsed.data.amount * 100);
  const requestKey = `stripe-checkout-${crypto.randomUUID()}`;
  const { data: paymentRequestId, error } = await supabase.rpc('create_stripe_payment_request', {
    amount_value: amountMinor,
    request_key: requestKey,
    target_business_id: context.businessId,
    target_invoice_id: invoice.id,
  });
  if (error || typeof paymentRequestId !== 'string')
    redirect(`/app/invoices/${invoice.id}?error=Online+payment+request+could+not+be+created.`);
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('Application URL unavailable');
    const session = await createInvoiceCheckoutSession({
      accountId: merchant.provider_account_id,
      amountMinor,
      appUrl,
      currency: invoice.currency_code,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      paymentRequestId,
    });
    if (!session.url) throw new Error('Checkout URL unavailable');
    const admin = createSupabaseAdminClient();
    const { error: attachError } = await admin.rpc('attach_stripe_checkout_session', {
      session_reference: session.id,
      target_request_id: paymentRequestId,
    });
    if (attachError) throw attachError;
    redirect(session.url);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    redirect(`/app/invoices/${invoice.id}?error=Stripe+checkout+could+not+be+started.`);
  }
}
