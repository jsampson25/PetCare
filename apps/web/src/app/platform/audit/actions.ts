'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function requestAuditExport(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.audit.export')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('request_platform_audit_export', {
    target_business_id: String(formData.get('businessId') ?? '') || null,
    target_actor_id: String(formData.get('actorId') ?? '') || null,
    event_query_value: String(formData.get('eventQuery') ?? ''),
    case_key_query_value: String(formData.get('caseKey') ?? ''),
    occurred_from_value: new Date(String(formData.get('from') ?? '')).toISOString(),
    occurred_to_value: new Date(String(formData.get('to') ?? '')).toISOString(),
    result_limit_value: Number(formData.get('resultLimit') ?? 100),
    purpose_value: String(formData.get('purpose') ?? ''),
    expires_at_value: new Date(String(formData.get('expiresAt') ?? '')).toISOString(),
    request_key: `audit-export-${randomUUID()}`,
  });
  revalidatePath('/platform/audit');
}
export async function approveAuditExport(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.audit.export')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('approve_platform_audit_export', {
    export_request_id_value: String(formData.get('requestId') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `audit-export-approve-${randomUUID()}`,
  });
  revalidatePath('/platform/audit');
}
