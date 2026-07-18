'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const bookingSchema = z.object({ bookingId: z.uuid() });

export async function recordArrival(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/arrivals?error=Booking+unavailable.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_booking_arrival', {
    request_key: `arrival-${parsed.data.bookingId}`,
    target_booking_id: parsed.data.bookingId,
    target_business_id: context.businessId,
  });
  if (error)
    redirect(`/app/arrivals/${parsed.data.bookingId}?error=Arrival+could+not+be+recorded.`);
  redirect(
    `/app/arrivals/${parsed.data.bookingId}?notice=Arrival+recorded.+Complete+each+pet's+safety+review.`,
  );
}

const checkInSchema = bookingSchema.extend({
  petId: z.uuid(),
  presenterName: z.string().trim().min(2).max(160),
  relationship: z.enum(['owner', 'household_member', 'authorized_pickup', 'other']),
  verificationMethod: z.enum(['photo_id', 'account_questions', 'known_customer', 'other']),
  petName: z.string().trim().min(1).max(100),
  petBreed: z.string().trim().min(1).max(120),
  conditionNotes: z.string().trim().max(1000).optional(),
  itemCategory: z.enum(['belonging', 'food', 'medication']).optional(),
  itemName: z.string().trim().max(200).optional(),
  itemQuantity: z.coerce.number().positive().max(999).optional(),
  itemUnit: z.string().trim().max(40).optional(),
  storageLocation: z.string().trim().max(160).optional(),
  safetyConfirmed: z.literal('yes'),
});

export async function completePetCheckIn(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const parsed = checkInSchema.safeParse(Object.fromEntries(formData));
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!parsed.success)
    redirect(`/app/arrivals/${bookingId}?error=Complete+every+required+safety+field.`);
  const custody = parsed.data.itemName
    ? [
        {
          category: parsed.data.itemCategory ?? 'belonging',
          name: parsed.data.itemName,
          quantity: parsed.data.itemQuantity ?? 1,
          unit: parsed.data.itemUnit || 'item',
          storage: parsed.data.storageLocation || null,
          return_expected: true,
        },
      ]
    : [];
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('complete_pet_check_in', {
    condition_value: {
      notes: parsed.data.conditionNotes || null,
      observed_at: new Date().toISOString(),
    },
    custody_value: custody,
    identifiers_value: [`name:${parsed.data.petName}`, `breed:${parsed.data.petBreed}`],
    presenter_value: parsed.data.presenterName,
    relationship_value: parsed.data.relationship,
    request_key: `check-in-${parsed.data.bookingId}-${parsed.data.petId}`,
    target_booking_id: parsed.data.bookingId,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
    verification_value: parsed.data.verificationMethod,
  });
  if (error)
    redirect(
      `/app/arrivals/${parsed.data.bookingId}?error=Eligibility,+open+requirements,+or+intake+details+prevented+check-in.`,
    );
  redirect(
    `/app/arrivals/${parsed.data.bookingId}?notice=Pet+checked+in+and+care+snapshot+secured.`,
  );
}
