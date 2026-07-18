'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function acceptPortalInvitation(formData: FormData) {
  const token = z.string().min(32).safeParse(formData.get('token'));
  if (!token.success) redirect('/invite/unavailable');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('accept_customer_portal_invitation', {
    invitation_token: token.data,
  });
  if (error) redirect('/invite/unavailable');
  redirect('/portal');
}
