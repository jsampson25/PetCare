'use server';

import { revalidatePath } from 'next/cache';

import { resolveBusinessContext } from '../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export async function acknowledgePlatformNotice(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('acknowledge_platform_notice', {
    target_business_id: context.businessId,
    notice_id_value: String(formData.get('noticeId') ?? ''),
  });
  revalidatePath('/app');
}
