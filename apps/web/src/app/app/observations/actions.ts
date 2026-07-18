'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const observationSchema = z.object({
  petVisitId: z.uuid(),
  category: z.enum(['activity', 'elimination', 'rest', 'wellness']),
  observationType: z.string().trim().min(2).max(100),
  details: z.string().trim().min(3).max(2000),
  concernLevel: z.enum(['information', 'warning', 'urgent', 'critical']),
  customerVisible: z.string().optional(),
  observedAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
});

export async function recordVisitObservation(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.record_observation')) redirect('/denied');
  const parsed = observationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/observations?error=Complete+the+structured+observation.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_visit_observation', {
    category_value: parsed.data.category,
    concern_value: parsed.data.concernLevel,
    customer_visible_value: parsed.data.customerVisible === 'yes',
    details_value: { observation: parsed.data.details },
    observed_value: new Date(parsed.data.observedAt).toISOString(),
    request_key: `observation-${crypto.randomUUID()}`,
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
    type_value: parsed.data.observationType,
  });
  if (error) redirect('/app/observations?error=The+pet+or+observation+is+no+longer+available.');
  redirect('/app/observations?notice=Observation+recorded.');
}
