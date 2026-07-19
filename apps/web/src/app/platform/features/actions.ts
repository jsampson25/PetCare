'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function configureFeature(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.features.manage')) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc('configure_platform_feature', {
    feature_key_value: String(formData.get('featureKey') ?? ''),
    display_name_value: String(formData.get('displayName') ?? ''),
    description_value: String(formData.get('description') ?? ''),
    entitlement_key_value: String(formData.get('entitlementKey') ?? ''),
    release_state_value: String(formData.get('releaseState') ?? ''),
    rollout_percentage_value: Number(formData.get('rolloutPercentage') ?? 0),
    reason_value: String(formData.get('reason') ?? ''),
    confirmation_value: String(formData.get('confirmation') ?? ''),
    request_key: `feature-${randomUUID()}`,
  });
  revalidatePath('/platform/features');
}

export async function setFeatureOverride(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.features.manage')) return;

  const expiresAt = String(formData.get('expiresAt') ?? '');
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('set_platform_feature_override', {
    target_business_id: String(formData.get('businessId') ?? ''),
    feature_key_value: String(formData.get('featureKey') ?? ''),
    override_state_value: String(formData.get('overrideState') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    expires_at_value: expiresAt ? new Date(expiresAt).toISOString() : null,
    request_key: `feature-override-${randomUUID()}`,
  });
  revalidatePath('/platform/features');
}
