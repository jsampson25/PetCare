'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
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
