'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const customerPetSchema = z.object({
  birthDate: z.union([z.literal(''), z.string().date()]),
  birthDateEstimated: z.string().optional(),
  breed: z.string().trim().min(1).max(120),
  email: z.email().max(320),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  petName: z.string().trim().min(1).max(100),
  petSex: z.enum(['female', 'male', 'unknown']),
  phone: z.string().trim().min(7).max(30),
  preferredName: z.string().trim().max(100),
});

export async function createCustomerHouseholdWithPet(formData: FormData) {
  const context = await resolveBusinessContext();
  if (
    !context ||
    !context.permissions.has('customers.manage') ||
    !context.permissions.has('pets.manage_care')
  ) {
    redirect('/denied');
  }

  const parsed = customerPetSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed.success || (parsed.data.birthDate && parsed.data.birthDate > today)) {
    redirect('/app/customers?error=Check+the+customer+and+pet+details.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_customer_household_with_pet', {
    customer_email: parsed.data.email,
    customer_first_name: parsed.data.firstName,
    customer_last_name: parsed.data.lastName,
    customer_phone: parsed.data.phone,
    customer_preferred_name: parsed.data.preferredName,
    pet_birth_date: parsed.data.birthDate || null,
    pet_birth_date_is_estimated: parsed.data.birthDateEstimated === 'on',
    pet_breed: parsed.data.breed,
    pet_name: parsed.data.petName,
    pet_sex: parsed.data.petSex,
    target_business_id: context.businessId,
  });

  if (error) {
    redirect(
      '/app/customers?error=The+customer+could+not+be+created.+Check+for+an+existing+email+and+try+again.',
    );
  }
  redirect('/app/customers?notice=Customer,+household,+and+first+pet+created.');
}
