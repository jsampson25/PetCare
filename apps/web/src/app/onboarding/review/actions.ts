'use server';

import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function launchBusiness() {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/sign-in');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('app').rpc('launch_tenant_business', {
    target_business_id: context.businessId,
  });

  if (error) {
    redirect(`/onboarding/review?error=${encodeURIComponent(error.message)}`);
  }

  const result = data as { public_slug?: string } | null;
  const publicSlug = result?.public_slug;
  redirect(
    `/onboarding/review?launched=1${publicSlug ? `&site=${encodeURIComponent(publicSlug)}` : ''}`,
  );
}
