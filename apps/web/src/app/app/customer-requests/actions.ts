'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function reviewCustomerRequest(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('customers.manage')) redirect('/denied');
  const parsed = z
    .object({
      requestId: z.uuid(),
      status: z.enum(['in_review', 'approved', 'declined', 'completed']),
      notes: z.string().trim().min(5).max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customer-requests?error=Document+the+review+decision.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_customer_service_request', {
    target_business_id: context.businessId,
    target_request_id: parsed.data.requestId,
    new_status_value: parsed.data.status,
    notes_value: parsed.data.notes,
    request_key: `customer-request-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/customer-requests?error=That+status+transition+is+not+available.');
  redirect('/app/customer-requests?notice=Request+status+updated.');
}
