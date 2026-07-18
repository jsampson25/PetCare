'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

async function contextAndClient() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_playgroup')) redirect('/denied');
  return { context, supabase: await createSupabaseServerClient() };
}

export async function recordDaycareEvaluation(formData: FormData) {
  const parsed = z
    .object({
      executionId: z.uuid(),
      outcome: z.enum(['approved', 'restricted', 'not_approved']),
      restrictions: z.string().trim().max(1000).optional(),
      notes: z.string().trim().min(5).max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/playgroups?error=Complete+the+structured+evaluation.');
  const { context, supabase } = await contextAndClient();
  const restrictions = parsed.data.restrictions ? { handling: parsed.data.restrictions } : {};
  const { error } = await supabase.rpc('record_daycare_evaluation', {
    target_business_id: context.businessId,
    target_execution_id: parsed.data.executionId,
    outcome_value: parsed.data.outcome,
    restrictions_value: restrictions,
    notes_value: parsed.data.notes,
    request_key: `daycare-evaluation-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/playgroups?error=The+evaluation+failed+its+safety+checks.');
  redirect('/app/playgroups?notice=Daycare+evaluation+recorded.');
}

export async function createPlaygroupSession(formData: FormData) {
  const parsed = z
    .object({
      locationId: z.uuid(),
      label: z.string().trim().min(2).max(120),
      sizeBand: z.enum(['small', 'medium', 'large', 'mixed', 'special_needs']),
      maxPets: z.coerce.number().int().min(1).max(100),
      petsPerStaff: z.coerce.number().int().min(1).max(25),
      staffCount: z.coerce.number().int().min(1).max(25),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/playgroups?error=Complete+the+staffed+session+limits.');
  const { context, supabase } = await contextAndClient();
  const { error } = await supabase.rpc('create_playgroup_session', {
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    label_value: parsed.data.label,
    size_band_value: parsed.data.sizeBand,
    max_pets_value: parsed.data.maxPets,
    pets_per_staff_value: parsed.data.petsPerStaff,
    staff_count_value: parsed.data.staffCount,
    request_key: `playgroup-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/playgroups?error=The+playgroup+could+not+be+opened.');
  redirect('/app/playgroups?notice=Staffed+playgroup+opened.');
}

export async function addPlaygroupParticipant(formData: FormData) {
  const parsed = z
    .object({ sessionId: z.uuid(), executionId: z.uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/playgroups?error=Select+a+session+and+eligible+pet.');
  const { context, supabase } = await contextAndClient();
  const { error } = await supabase.rpc('add_playgroup_participant', {
    target_business_id: context.businessId,
    target_session_id: parsed.data.sessionId,
    target_execution_id: parsed.data.executionId,
    request_key: `playgroup-join-${crypto.randomUUID()}`,
  });
  if (error)
    redirect('/app/playgroups?error=Evaluation,+staffing,+capacity,+or+stage+blocked+placement.');
  redirect('/app/playgroups?notice=Pet+joined+the+playgroup.');
}

export async function transitionPlaygroupParticipant(formData: FormData) {
  const parsed = z
    .object({
      participantId: z.uuid(),
      nextStatus: z.enum(['active', 'resting', 'removed', 'completed']),
      removalCategory: z.enum(['safety', 'behavior', 'wellness', 'other']).optional(),
      notes: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/playgroups?error=Complete+the+participant+transition.');
  const { context, supabase } = await contextAndClient();
  const { error } = await supabase.rpc('transition_playgroup_participant', {
    target_business_id: context.businessId,
    target_participant_id: parsed.data.participantId,
    next_status: parsed.data.nextStatus,
    category_value: parsed.data.removalCategory ?? 'other',
    notes_value: parsed.data.notes ?? '',
    request_key: `playgroup-state-${crypto.randomUUID()}`,
  });
  if (error)
    redirect('/app/playgroups?error=The+transition+requires+safety+details+or+manager+clearance.');
  redirect('/app/playgroups?notice=Participant+status+updated.');
}

export async function clearPlaygroupRemoval(formData: FormData) {
  const parsed = z
    .object({ participantId: z.uuid(), clearanceNotes: z.string().trim().min(8).max(2000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/playgroups?error=Document+the+manager+clearance.');
  const { context, supabase } = await contextAndClient();
  const { error } = await supabase.rpc('clear_playgroup_removal', {
    target_business_id: context.businessId,
    target_participant_id: parsed.data.participantId,
    notes_value: parsed.data.clearanceNotes,
    request_key: `playgroup-clear-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/playgroups?error=Manager+clearance+could+not+be+recorded.');
  redirect('/app/playgroups?notice=Removal+review+cleared.');
}
