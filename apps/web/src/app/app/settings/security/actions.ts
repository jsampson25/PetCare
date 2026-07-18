'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { businessContextCookie } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function signOutOtherSessions() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  const message = error
    ? 'Other sessions could not be revoked. Try again.'
    : 'Other sessions have been revoked.';
  redirect(`/app/settings/security?${error ? 'error' : 'notice'}=${encodeURIComponent(message)}`);
}

export async function signOutEverywhere() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    redirect('/app/settings/security?error=All+sessions+could+not+be+revoked.+Try+again.');
  }
  const cookieStore = await cookies();
  cookieStore.delete(businessContextCookie);
  redirect('/auth/sign-in?notice=All+sessions+have+been+revoked.');
}
