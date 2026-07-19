'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function createClosureCase(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.closure.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('create_tenant_closure_case', {
    target_business_id: String(formData.get('businessId') ?? ''),
    target_close_at_value: new Date(String(formData.get('targetCloseAt') ?? '')).toISOString(),
    retention_until_value: String(formData.get('retentionUntil') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `closure-${randomUUID()}`,
  });
  revalidatePath('/platform/closures');
}
export async function markExportReady(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.closure.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('mark_tenant_closure_export_ready', {
    closure_case_id_value: String(formData.get('caseId') ?? ''),
    export_reference_value: String(formData.get('exportReference') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `closure-export-${randomUUID()}`,
  });
  revalidatePath('/platform/closures');
}
export async function addRetentionHold(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.closure.manage')) return;
  const supabase = await createSupabaseServerClient();
  const expiry = String(formData.get('expiresAt') ?? '');
  await supabase.rpc('add_tenant_retention_hold', {
    closure_case_id_value: String(formData.get('caseId') ?? ''),
    hold_type_value: String(formData.get('holdType') ?? ''),
    basis_value: String(formData.get('basis') ?? ''),
    expires_at_value: expiry ? new Date(expiry).toISOString() : null,
    request_key: `closure-hold-${randomUUID()}`,
  });
  revalidatePath('/platform/closures');
}
export async function transitionClosure(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.closure.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('transition_tenant_closure', {
    closure_case_id_value: String(formData.get('caseId') ?? ''),
    next_status_value: String(formData.get('nextStatus') ?? ''),
    readiness_fingerprint_value: String(formData.get('fingerprint') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    confirmation_value: String(formData.get('confirmation') ?? ''),
    request_key: `closure-state-${randomUUID()}`,
  });
  revalidatePath('/platform/closures');
}
