'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function transitionTenant(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.businesses.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('apply_platform_tenant_control', {
    target_business_id: String(formData.get('businessId') ?? ''),
    next_status_value: String(formData.get('nextStatus') ?? ''),
    restriction_code_value: String(formData.get('restrictionCode') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    confirmation_value: String(formData.get('confirmation') ?? ''),
    impact_fingerprint_value: String(formData.get('impactFingerprint') ?? ''),
    review_at_value: formData.get('reviewAt')
      ? new Date(String(formData.get('reviewAt'))).toISOString()
      : null,
    request_key: `platform-${randomUUID()}`,
  });
  revalidatePath('/platform/businesses');
}
