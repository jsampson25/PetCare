'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function retryProvisioningStep(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.provisioning.manage')) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('retry_tenant_provisioning_step', {
    run_id_value: String(formData.get('runId') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `provisioning-retry-${randomUUID()}`,
  });
  revalidatePath('/platform/provisioning');
}
