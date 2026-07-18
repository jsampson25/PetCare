'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function reviewWebsiteInquiry(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const parsed = z
    .object({
      inquiryId: z.uuid(),
      status: z.enum(['in_review', 'responded', 'closed', 'spam']),
      notes: z.string().trim().min(5).max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/website-inquiries?error=Document+the+inquiry+decision.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_website_inquiry', {
    target_business_id: context.businessId,
    target_inquiry_id: parsed.data.inquiryId,
    new_status_value: parsed.data.status,
    notes_value: parsed.data.notes,
    request_key: `inquiry-review-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/website-inquiries?error=That+inquiry+transition+is+unavailable.');
  redirect('/app/website-inquiries?notice=Inquiry+updated.');
}
