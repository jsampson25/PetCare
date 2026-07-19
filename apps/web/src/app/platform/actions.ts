'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export async function createOperationalIssue(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.health.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('create_platform_operational_issue', {
    target_business_id: String(formData.get('businessId') ?? '') || null,
    correlation_key_value: String(formData.get('correlationKey') ?? ''),
    source_type_value: String(formData.get('sourceType') ?? ''),
    source_reference_value: String(formData.get('sourceReference') ?? ''),
    severity_value: String(formData.get('severity') ?? ''),
    summary_value: String(formData.get('summary') ?? ''),
    impact_summary_value: String(formData.get('impactSummary') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `health-${randomUUID()}`,
  });
  revalidatePath('/platform');
}

export async function transitionOperationalIssue(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.health.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('transition_platform_operational_issue', {
    issue_id_value: String(formData.get('issueId') ?? ''),
    next_status_value: String(formData.get('nextStatus') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `health-state-${randomUUID()}`,
  });
  revalidatePath('/platform');
}
