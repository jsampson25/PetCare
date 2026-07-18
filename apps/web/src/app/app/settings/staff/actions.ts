'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export type InvitationFormState = {
  error?: string;
  invitationLink?: string;
};

const invitationSchema = z.object({
  email: z.email().max(320),
  role: z.string().regex(/^[a-z][a-z0-9_]*$/),
});

export async function inviteStaff(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('staff.invite'))
    return { error: 'You do not have permission to invite staff.' };

  const parsed = invitationSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: 'Enter a valid email and choose an available role.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_staff_invitation', {
    target_business_id: context.businessId,
    target_email: parsed.data.email,
    target_expires_in: '7 days',
    target_location_ids: [],
    target_location_scope_mode: 'all_current',
    target_role_keys: [parsed.data.role],
  });
  const created = data?.[0];
  if (error || !created?.invitation_token) {
    return { error: 'The invitation could not be created. Check the role and try again.' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required.');
  return { invitationLink: `${appUrl}/invite/${created.invitation_token}` };
}

export async function revokeInvitation(formData: FormData) {
  const context = await resolveBusinessContext();
  const invitationId = z.uuid().safeParse(formData.get('invitationId'));
  if (!context || !context.permissions.has('staff.invite') || !invitationId.success) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc('revoke_staff_invitation', { target_invitation_id: invitationId.data });
  revalidatePath('/app/settings/staff');
}
