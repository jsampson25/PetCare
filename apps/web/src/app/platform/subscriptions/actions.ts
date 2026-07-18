'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function assignSubscription(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.subscriptions.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('assign_tenant_saas_subscription', {
    target_business_id: String(formData.get('businessId') ?? ''),
    target_plan_version_id: String(formData.get('planVersionId') ?? ''),
    start_as_trial: formData.get('startAsTrial') === 'on',
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `subscription-${randomUUID()}`,
  });
  revalidatePath('/platform/subscriptions');
}
export async function transitionSubscription(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.subscriptions.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('transition_tenant_saas_subscription', {
    target_business_id: String(formData.get('businessId') ?? ''),
    next_status_value: String(formData.get('nextStatus') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `subscription-state-${randomUUID()}`,
  });
  revalidatePath('/platform/subscriptions');
}
