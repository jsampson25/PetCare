'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function retryAdministrativeJob(formData: FormData) {
  const context = await resolvePlatformContext();
  if (!context?.permissions.has('platform.jobs.manage')) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc('retry_platform_administrative_job', {
    target_job_id: String(formData.get('jobId') ?? ''),
    reason_value: String(formData.get('reason') ?? ''),
    request_key: `job-retry-${randomUUID()}`,
  });
  revalidatePath('/platform/jobs');
}
