'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
async function checkoutContext() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_out')) redirect('/denied');
  return { context, supabase: await createSupabaseServerClient() };
}
export async function recordCheckoutOverride(formData: FormData) {
  const parsed = z
    .object({
      petVisitId: z.uuid(),
      blockerType: z.enum([
        'pickup_authority',
        'service_not_ready',
        'open_care',
        'open_incident',
        'report_card_missing',
        'balance_due',
        'custody_exception',
      ]),
      reason: z.string().trim().min(12).max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/departures?error=Document+the+manager+override+reason.');
  const { context, supabase } = await checkoutContext();
  const { error } = await supabase.rpc('record_checkout_override', {
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
    blocker_value: parsed.data.blockerType,
    reason_value: parsed.data.reason,
    request_key: `checkout-override-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/departures?error=Only+a+manager+can+approve+that+checkout+exception.');
  redirect('/app/departures?notice=Checkout+exception+approved+and+audited.');
}
export async function completePetCheckout(formData: FormData) {
  const parsed = z
    .object({
      petVisitId: z.uuid(),
      pickupName: z.string().trim().min(2).max(160),
      pickupRelationship: z.enum(['owner', 'household_member', 'authorized_pickup', 'other']),
      verificationMethod: z.enum(['photo_id', 'account_questions', 'known_customer', 'other']),
      identityOne: z.string().trim().min(2).max(200),
      identityTwo: z.string().trim().min(2).max(200),
      handoffNotes: z.string().trim().max(2000).optional(),
      acknowledged: z.literal('yes'),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect('/app/departures?error=Complete+pickup+identity+and+handoff+acknowledgement.');
  const returns = formData.getAll('returnItemId').map((value) => {
    const id = String(value);
    return {
      item_id: id,
      status: String(formData.get(`returnStatus_${id}`) ?? ''),
      notes: String(formData.get(`returnNotes_${id}`) ?? ''),
    };
  });
  const { context, supabase } = await checkoutContext();
  const { error } = await supabase.rpc('complete_pet_checkout', {
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
    pickup_name_value: parsed.data.pickupName,
    relationship_value: parsed.data.pickupRelationship,
    verification_value: parsed.data.verificationMethod,
    evidence_value: [parsed.data.identityOne, parsed.data.identityTwo],
    returns_value: returns,
    handoff_value: parsed.data.handoffNotes ?? '',
    acknowledged_value: true,
    request_key: `checkout-${parsed.data.petVisitId}`,
  });
  if (error)
    redirect(
      '/app/departures?error=Checkout+still+has+an+unresolved+authority,+care,+financial,+or+custody+blocker.',
    );
  redirect('/app/departures?notice=Pet+custody+released+and+resource+turnover+started.');
}
