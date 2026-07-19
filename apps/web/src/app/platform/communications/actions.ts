'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function createOperationalNotice(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.communications.manage')) return;
  const audience = String(formData.get('audience') ?? '');
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('create_platform_operational_notice', {
    audience_value: audience,
    target_business_id: audience === 'tenant' ? String(formData.get('businessId') ?? '') : null,
    severity_value: String(formData.get('severity') ?? ''),
    title_value: String(formData.get('title') ?? ''),
    message_value: String(formData.get('message') ?? ''),
    starts_at_value: new Date(String(formData.get('startsAt') ?? '')).toISOString(),
    ends_at_value: new Date(String(formData.get('endsAt') ?? '')).toISOString(),
    acknowledgement_required_value: formData.get('acknowledgementRequired') === 'on',
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `platform-notice-${randomUUID()}`,
  });
  revalidatePath('/platform/communications');
}

export async function transitionOperationalNotice(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.communications.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('transition_platform_operational_notice', {
    notice_id_value: String(formData.get('noticeId') ?? ''),
    next_status_value: String(formData.get('nextStatus') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `platform-notice-state-${randomUUID()}`,
  });
  revalidatePath('/platform/communications');
}

export async function createInternalTenantNote(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.notes.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('create_platform_internal_tenant_note', {
    target_business_id: String(formData.get('businessId') ?? ''),
    category_value: String(formData.get('category') ?? ''),
    note_value: String(formData.get('note') ?? ''),
    retention_until_value: String(formData.get('retentionUntil') ?? ''),
    legal_hold_value: formData.get('legalHold') === 'on',
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `platform-note-${randomUUID()}`,
  });
  revalidatePath('/platform/communications');
}
