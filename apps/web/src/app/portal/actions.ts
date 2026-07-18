'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolvePortalDashboard } from '../../lib/auth/portal-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export async function submitBookingRequest(formData: FormData) {
  const parsed = z
    .object({
      bookingId: z.uuid(),
      requestType: z.enum(['booking_change', 'booking_cancellation']),
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(8).max(3000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/portal/reservations?error=Describe+the+requested+change.');
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('submit_customer_service_request', {
    target_business_id: dashboard.business.id,
    request_type_value: parsed.data.requestType,
    target_booking_id: parsed.data.bookingId,
    subject_value: parsed.data.subject,
    details_value: { message: parsed.data.message },
    request_key: `portal-request-${crypto.randomUUID()}`,
  });
  if (error)
    redirect('/portal/reservations?error=That+reservation+is+not+eligible+for+this+request.');
  redirect('/portal/requests?notice=Request+submitted+for+staff+review.');
}

export async function updatePortalProfile(formData: FormData) {
  const parsed = z
    .object({ preferredName: z.string().trim().max(100), phone: z.string().trim().min(7).max(30) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/portal/account?error=Enter+a+valid+phone+number.');
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('update_portal_customer_profile', {
    target_business_id: dashboard.business.id,
    preferred_name_value: parsed.data.preferredName,
    phone_value: parsed.data.phone,
  });
  if (error) redirect('/portal/account?error=Profile+could+not+be+updated.');
  redirect('/portal/account?notice=Profile+updated.');
}
