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
export async function previewPlanChange(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.subscriptions.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('preview_tenant_saas_plan_change', {
    target_business_id: String(formData.get('businessId')),
    target_plan_version_id: String(formData.get('planVersionId')),
    effective_timing_value: String(formData.get('effectiveTiming')),
    reason_value: String(formData.get('reason')),
  });
  revalidatePath('/platform/subscriptions');
}
export async function applyPlanChange(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.subscriptions.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('apply_tenant_saas_plan_change', {
    change_request_id_value: String(formData.get('changeRequestId')),
    preview_fingerprint_value: String(formData.get('fingerprint')),
    confirmation_value: String(formData.get('confirmation')),
    request_key: `plan-change-${randomUUID()}`,
  });
  revalidatePath('/platform/subscriptions');
}
export async function grantEntitlementOverride(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.subscriptions.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('grant_tenant_entitlement_override', {
    target_business_id: String(formData.get('businessId')),
    entitlement_key_value: String(formData.get('entitlementKey')),
    value_value: JSON.parse(String(formData.get('value') || 'null')),
    starts_at_value: new Date().toISOString(),
    expires_at_value: new Date(String(formData.get('expiresAt'))).toISOString(),
    reason_value: String(formData.get('reason')),
  });
  revalidatePath('/platform/subscriptions');
}
