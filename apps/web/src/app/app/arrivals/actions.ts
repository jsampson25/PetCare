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

const handoffSchema = z.object({
  bookingId: z.uuid(),
  petVisitId: z.uuid(),
  resourceId: z.preprocess((value) => value || undefined, z.uuid().optional()),
  handoffNotes: z.string().trim().max(1000).optional(),
  handoffConfirmed: z.literal('yes'),
});

export async function acceptOperationalHandoff(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const parsed = handoffSchema.safeParse(Object.fromEntries(formData));
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!parsed.success)
    redirect(`/app/arrivals/${bookingId}?error=Confirm+the+operational+handoff.`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('accept_operational_handoff', {
    handoff_note: parsed.data.handoffNotes || '',
    request_key: `handoff-${parsed.data.petVisitId}`,
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
    target_resource_id: parsed.data.resourceId ?? null,
  });
  if (error)
    redirect(
      `/app/arrivals/${parsed.data.bookingId}?error=The+resource+or+handoff+is+no+longer+available.`,
    );
  redirect(`/app/arrivals/${parsed.data.bookingId}?notice=Operational+handoff+accepted.`);
}

const blockerResolutionSchema = z.object({
  actionId: z.uuid(),
  bookingId: z.uuid(),
  resolution: z.enum(['requirement_satisfied', 'approved_exception']),
  reason: z.string().trim().min(12).max(1000),
});

export async function resolveCheckInBlocker(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.roles.some((role) => role === 'owner' || role === 'manager'))
    redirect('/denied');
  const parsed = blockerResolutionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/arrivals?error=A+documented+manager+resolution+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('resolve_check_in_blocker', {
    evidence_value: { source: 'manager_check_in_review' },
    reason_value: parsed.data.reason,
    request_key: `check-in-resolution-${parsed.data.actionId}`,
    resolution_value: parsed.data.resolution,
    target_action_id: parsed.data.actionId,
    target_business_id: context.businessId,
  });
  if (error)
    redirect(
      `/app/arrivals/${parsed.data.bookingId}?error=This+blocker+must+be+resolved+through+its+authoritative+workflow.`,
    );
  redirect(`/app/arrivals/${parsed.data.bookingId}?notice=Manager+resolution+recorded.`);
}

const amendmentSchema = z.object({
  bookingId: z.uuid(),
  petVisitId: z.uuid(),
  category: z.enum(['feeding', 'medication', 'allergy', 'health', 'behavior', 'general']),
  instructions: z.string().trim().min(3).max(2000),
  reason: z.string().trim().min(8).max(1000),
  proposeMasterUpdate: z.string().optional(),
});

export async function addVisitCareAmendment(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const parsed = amendmentSchema.safeParse(Object.fromEntries(formData));
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!parsed.success)
    redirect(`/app/arrivals/${bookingId}?error=Add+structured+visit+instructions+and+a+reason.`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_visit_care_amendment', {
    amendment_value: { instructions: parsed.data.instructions },
    category_value: parsed.data.category,
    propose_master_update: parsed.data.proposeMasterUpdate === 'yes',
    reason_value: parsed.data.reason,
    request_key: `care-amendment-${crypto.randomUUID()}`,
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
  });
  if (error)
    redirect(
      `/app/arrivals/${parsed.data.bookingId}?error=That+care+change+requires+manager+review+or+an+active+visit.`,
    );
  redirect(`/app/arrivals/${parsed.data.bookingId}?notice=Visit-only+care+amendment+added.`);
}
