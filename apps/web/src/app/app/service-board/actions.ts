'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const initializeSchema = z.object({ petVisitId: z.uuid() });

export async function initializeServiceExecution(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.execute_service')) redirect('/denied');
  const parsed = initializeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/service-board?error=Select+an+active+pet+service.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('initialize_service_execution', {
    request_key: `service-start-${parsed.data.petVisitId}`,
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
  });
  if (error) redirect('/app/service-board?error=The+service+is+not+ready+to+start.');
  redirect('/app/service-board?notice=Service+execution+started.');
}

const transitionSchema = z.object({
  executionId: z.uuid(),
  nextStage: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(2000).optional(),
});

export async function transitionServiceExecution(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.execute_service')) redirect('/denied');
  const parsed = transitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/service-board?error=Choose+a+valid+stage.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_service_execution', {
    next_stage: parsed.data.nextStage,
    notes_value: parsed.data.notes ?? '',
    request_key: `service-stage-${crypto.randomUUID()}`,
    target_business_id: context.businessId,
    target_execution_id: parsed.data.executionId,
  });
  if (error) redirect('/app/service-board?error=That+stage+change+is+not+allowed+or+needs+notes.');
  redirect('/app/service-board?notice=Service+stage+updated.');
}
