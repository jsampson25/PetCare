'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

async function permitted(permission: string) {
  const context = await resolvePlatformContext();
  return context?.permissions.has(permission) ?? false;
}
export async function activateBreakGlass(formData: FormData) {
  if (!(await permitted('platform.break_glass.manage'))) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('activate_platform_break_glass', {
    target_business_id: String(formData.get('businessId')),
    incident_key_value: String(formData.get('incidentKey')),
    scopes_value: formData.getAll('scopes').map(String),
    reason_value: String(formData.get('reason')),
    request_key: `break-glass-${randomUUID()}`,
  });
  revalidatePath('/platform/governance');
}
export async function endBreakGlass(formData: FormData) {
  if (!(await permitted('platform.break_glass.manage'))) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('end_platform_break_glass', {
    session_id_value: String(formData.get('sessionId')),
    reason_value: String(formData.get('reason')),
    request_key: `break-glass-end-${randomUUID()}`,
  });
  revalidatePath('/platform/governance');
}
export async function reviewBreakGlass(formData: FormData) {
  if (!(await permitted('platform.break_glass.manage'))) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('review_platform_break_glass', {
    session_id_value: String(formData.get('sessionId')),
    outcome_value: String(formData.get('outcome')),
    reason_value: String(formData.get('reason')),
    request_key: `break-glass-review-${randomUUID()}`,
  });
  revalidatePath('/platform/governance');
}
export async function requestPurge(formData: FormData) {
  if (!(await permitted('platform.purge.manage'))) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('request_tenant_purge', {
    closure_case_id_value: String(formData.get('caseId')),
    readiness_fingerprint_value: String(formData.get('fingerprint')),
    reason_value: String(formData.get('reason')),
    confirmation_value: String(formData.get('confirmation')),
    request_key: `purge-${randomUUID()}`,
  });
  revalidatePath('/platform/governance');
}
export async function approvePurge(formData: FormData) {
  if (!(await permitted('platform.purge.manage'))) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('approve_tenant_purge', {
    purge_request_id_value: String(formData.get('purgeRequestId')),
    confirmation_value: String(formData.get('confirmation')),
    reason_value: String(formData.get('reason')),
    request_key: `purge-approve-${randomUUID()}`,
  });
  revalidatePath('/platform/governance');
}
