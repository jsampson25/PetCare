'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const bookingSchema = z.object({
  coupon: z.string().trim().max(32).optional(),
  customerId: z.uuid(),
  endsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  locationId: z.uuid(),
  petId: z.uuid(),
  quantity: z.coerce.number().int().positive().max(20),
  serviceId: z.uuid(),
  startsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  units: z.coerce.number().int().positive().max(365),
});

export async function createBookingRequest(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.create')) redirect('/denied');
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/bookings/new?error=Check+the+booking+details.');
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (endsAt <= startsAt) redirect('/app/bookings/new?error=The+end+must+be+after+the+start.');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_booking_request', {
    coupon_value: parsed.data.coupon || null,
    request_key: `staff-${crypto.randomUUID()}`,
    requested_end: endsAt.toISOString(),
    requested_quantity: parsed.data.quantity,
    requested_start: startsAt.toISOString(),
    requested_units: parsed.data.units,
    source_value: 'staff',
    target_business_id: context.businessId,
    target_customer_id: parsed.data.customerId,
    target_location_id: parsed.data.locationId,
    target_pet_id: parsed.data.petId,
    target_service_id: parsed.data.serviceId,
  });
  if (error || typeof data !== 'string')
    redirect(
      '/app/bookings/new?error=Requirements,+capacity,+or+published+pricing+prevented+this+request.',
    );
  redirect(`/app/bookings/${data}?notice=Booking+request+created.`);
}

const waitlistSchema = bookingSchema.omit({ coupon: true, units: true }).extend({
  flexibilityDays: z.coerce.number().int().min(0).max(30),
});
export async function createWaitlistEntry(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.create')) redirect('/denied');
  const parsed = waitlistSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/bookings/new?error=Check+the+waitlist+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_waitlist_entry', {
    flex_days: parsed.data.flexibilityDays,
    request_key: `staff-waitlist-${crypto.randomUUID()}`,
    requested_end: new Date(parsed.data.endsAt).toISOString(),
    requested_quantity: parsed.data.quantity,
    requested_start: new Date(parsed.data.startsAt).toISOString(),
    target_business_id: context.businessId,
    target_customer_id: parsed.data.customerId,
    target_location_id: parsed.data.locationId,
    target_pet_id: parsed.data.petId,
    target_service_id: parsed.data.serviceId,
  });
  if (error) redirect('/app/bookings/new?error=The+waitlist+entry+could+not+be+created.');
  redirect('/app/bookings?notice=Waitlist+entry+created.');
}

const cancelSchema = z.object({ bookingId: z.uuid(), reason: z.string().trim().min(8).max(500) });
export async function cancelBooking(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.cancel')) redirect('/denied');
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/bookings?error=A+detailed+cancellation+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('cancel_booking', {
    reason_value: parsed.data.reason,
    request_key: `cancel-${crypto.randomUUID()}`,
    target_booking_id: parsed.data.bookingId,
    target_business_id: context.businessId,
  });
  if (error) redirect(`/app/bookings/${parsed.data.bookingId}?error=Cancellation+failed.`);
  redirect(`/app/bookings/${parsed.data.bookingId}?notice=Booking+cancelled.`);
}
