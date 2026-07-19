'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function createPrivacyRequest(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.privacy.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('create_platform_privacy_request', {
    target_business_id: String(formData.get('businessId') ?? ''),
    request_type_value: String(formData.get('requestType') ?? ''),
    subject_reference_value: String(formData.get('subjectReference') ?? ''),
    intake_channel_value: String(formData.get('intakeChannel') ?? ''),
    due_at_value: new Date(String(formData.get('dueAt') ?? '')).toISOString(),
    legal_hold_value: formData.get('legalHold') === 'on',
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `privacy-${randomUUID()}`,
  });
  revalidatePath('/platform/privacy');
}

export async function transitionPrivacyRequest(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.privacy.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('transition_platform_privacy_request', {
    privacy_request_id_value: String(formData.get('requestId') ?? ''),
    next_status_value: String(formData.get('nextStatus') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `privacy-state-${randomUUID()}`,
  });
  revalidatePath('/platform/privacy');
}

export async function recordPrivacyDomainAction(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.privacy.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('record_platform_privacy_domain_action', {
    privacy_request_id_value: String(formData.get('requestId') ?? ''),
    domain_key_value: String(formData.get('domainKey') ?? ''),
    action_type_value: String(formData.get('actionType') ?? ''),
    status_value: String(formData.get('status') ?? ''),
    evidence_summary_value: String(formData.get('evidenceSummary') ?? ''),
    retention_basis_value: String(formData.get('retentionBasis') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `privacy-action-${randomUUID()}`,
  });
  revalidatePath('/platform/privacy');
}
