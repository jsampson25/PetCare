'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export type PortalInvitationState = { error?: string; invitationLink?: string };
export async function inviteCustomerToPortal(
  _previous: PortalInvitationState,
  formData: FormData,
): Promise<PortalInvitationState> {
  const context = await resolveBusinessContext();
  const customerId = z.uuid().safeParse(formData.get('customerId'));
  if (!context?.permissions.has('customers.manage') || !customerId.success)
    return { error: 'Portal invitation is unavailable.' };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_customer_portal_invitation', {
    target_business_id: context.businessId,
    target_customer_id: customerId.data,
    target_expires_in: '7 days',
  });
  const created = data?.[0];
  if (error || !created?.invitation_token)
    return { error: 'Active access exists or the customer cannot be invited.' };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required.');
  return { invitationLink: `${appUrl}/portal-invite/${created.invitation_token}` };
}

export async function revokeCustomerPortalAccess(formData: FormData) {
  const context = await resolveBusinessContext();
  const parsed = z
    .object({ customerId: z.uuid(), reason: z.string().trim().min(5).max(1000) })
    .safeParse(Object.fromEntries(formData));
  if (!context?.permissions.has('customers.manage') || !parsed.success) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('revoke_customer_portal_access', {
    target_business_id: context.businessId,
    target_customer_id: parsed.data.customerId,
    reason_value: parsed.data.reason,
  });
  if (error)
    redirect(`/app/customers/${parsed.data.customerId}?error=Portal+access+could+not+be+revoked.`);
  redirect(`/app/customers/${parsed.data.customerId}?notice=Portal+access+revoked.`);
}

const petSchema = z.object({
  birthDate: z.union([z.literal(''), z.string().date()]),
  birthDateEstimated: z.string().optional(),
  breed: z.string().trim().min(1).max(120),
  customerId: z.uuid(),
  petName: z.string().trim().min(1).max(100),
  petSex: z.enum(['female', 'male', 'unknown']),
});

export async function addPetToCustomerHousehold(formData: FormData) {
  const context = await resolveBusinessContext();
  if (
    !context ||
    !context.permissions.has('customers.view') ||
    !context.permissions.has('pets.manage_care')
  ) {
    redirect('/denied');
  }

  const parsed = petSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed.success) redirect('/app/customers?error=Check+the+pet+details.');
  if (parsed.data.birthDate && parsed.data.birthDate > today) {
    redirect(`/app/customers/${parsed.data.customerId}?error=Birth+date+cannot+be+in+the+future.`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_to_customer_household', {
    pet_birth_date: parsed.data.birthDate || null,
    pet_birth_date_is_estimated: parsed.data.birthDateEstimated === 'on',
    pet_breed: parsed.data.breed,
    pet_name: parsed.data.petName,
    pet_sex: parsed.data.petSex,
    target_business_id: context.businessId,
    target_customer_id: parsed.data.customerId,
  });

  if (error) {
    redirect(`/app/customers/${parsed.data.customerId}?error=The+pet+could+not+be+added.`);
  }
  redirect(`/app/customers/${parsed.data.customerId}?notice=Pet+added+to+the+household.`);
}
