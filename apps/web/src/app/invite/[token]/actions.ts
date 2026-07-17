'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { businessContextCookie } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function acceptInvitation(formData: FormData) {
  const token = formData.get('token');
  if (typeof token !== 'string' || token.length < 32) redirect('/invite/unavailable');

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect(`/auth/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);

  const { data, error } = await supabase.rpc('accept_staff_invitation', { invitation_token: token });
  const accepted = data?.[0];
  if (error || !accepted?.business_id) redirect('/invite/unavailable');

  const cookieStore = await cookies();
  cookieStore.set(businessContextCookie, accepted.business_id, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/app');
}
