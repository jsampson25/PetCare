'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function openSupportSession(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.support.manage')) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc('open_platform_support_session', {
    target_business_id: String(formData.get('businessId') ?? ''),
    case_key_value: String(formData.get('caseKey') ?? '')
      .trim()
      .toUpperCase(),
    case_summary_value: String(formData.get('caseSummary') ?? ''),
    scopes_value: formData.getAll('scopes').map(String),
    write_enabled_value: formData.get('writeEnabled') === 'on',
    duration_minutes: Number(formData.get('durationMinutes') ?? 30),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `support-${randomUUID()}`,
  });
  revalidatePath('/platform/support');
}

export async function revokeSupportSession(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.support.manage')) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc('revoke_platform_support_session', {
    support_session_id_value: String(formData.get('sessionId') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `support-revoke-${randomUUID()}`,
  });
  revalidatePath('/platform/support');
}
