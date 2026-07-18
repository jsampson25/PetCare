'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

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
