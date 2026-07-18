'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const scheduleSchema = z.object({
  petVisitId: z.uuid(),
  taskType: z.enum(['feeding', 'medication']),
  title: z.string().trim().min(2).max(200),
  instructions: z.string().trim().min(3).max(2000),
  dueStartsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  dueEndsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  priority: z.enum(['routine', 'urgent', 'critical']),
});

export async function scheduleCareTask(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/denied');
  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/tasks?error=Add+a+valid+task+and+due+window.');
  const permission =
    parsed.data.taskType === 'medication'
      ? 'operations.record_medication'
      : 'operations.record_feeding';
  if (!context.permissions.has(permission)) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('schedule_snapshot_care_task', {
    due_end_value: new Date(parsed.data.dueEndsAt).toISOString(),
    due_start_value: new Date(parsed.data.dueStartsAt).toISOString(),
    instructions_value: { instructions: parsed.data.instructions },
    priority_value: parsed.data.priority,
    request_key: `care-task-${crypto.randomUUID()}`,
    source_record_value: null,
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
    task_type_value: parsed.data.taskType,
    title_value: parsed.data.title,
  });
  if (error)
    redirect('/app/tasks?error=The+pet,+snapshot,+permission,+or+due+window+prevented+scheduling.');
  redirect('/app/tasks?notice=Care+task+scheduled.');
}

const outcomeSchema = z.object({
  taskId: z.uuid(),
  taskType: z.enum(['feeding', 'medication']),
  outcome: z.enum(['completed', 'partial', 'refused', 'held', 'missed', 'unable', 'adverse']),
  details: z.string().trim().min(2).max(2000),
  reason: z.string().trim().max(1000).optional(),
  petIdentityConfirmed: z.literal('yes'),
  fiveRightsConfirmed: z.string().optional(),
});

export async function recordCareTaskOutcome(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/denied');
  const parsed = outcomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/tasks?error=Complete+the+structured+outcome+and+pet+check.');
  const permission =
    parsed.data.taskType === 'medication'
      ? 'operations.record_medication'
      : 'operations.record_feeding';
  if (!context.permissions.has(permission)) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_care_task_outcome', {
    details_value: {
      five_rights_confirmed: parsed.data.fiveRightsConfirmed === 'yes',
      observation: parsed.data.details,
    },
    identity_confirmed: true,
    outcome_value: parsed.data.outcome,
    reason_value: parsed.data.reason || '',
    request_key: `care-outcome-${parsed.data.taskId}`,
    target_business_id: context.businessId,
    target_task_id: parsed.data.taskId,
  });
  if (error)
    redirect('/app/tasks?error=The+task+changed+or+the+required+safety+verification+is+missing.');
  redirect('/app/tasks?notice=Care+outcome+recorded.');
}

const alertSchema = z.object({
  alertId: z.uuid(),
  alertStatus: z.enum(['acknowledged', 'resolved']),
  resolutionNotes: z.string().trim().max(2000).optional(),
});

export async function transitionOperationalAlert(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/denied');
  const canRecordCare = [
    'operations.record_feeding',
    'operations.record_medication',
    'operations.record_observation',
  ].some((permission) => context.permissions.has(permission));
  if (!canRecordCare) redirect('/denied');
  const parsed = alertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || (parsed.data.alertStatus === 'resolved' && !parsed.data.resolutionNotes)) {
    redirect('/app/tasks?error=Resolution+notes+are+required+to+close+an+alert.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_operational_alert', {
    new_status: parsed.data.alertStatus,
    notes_value: parsed.data.resolutionNotes ?? '',
    target_alert_id: parsed.data.alertId,
    target_business_id: context.businessId,
  });
  if (error) redirect('/app/tasks?error=The+alert+changed+or+requires+manager+resolution.');
  redirect('/app/tasks?notice=Care+alert+updated.');
}

const correctionSchema = z.object({
  taskId: z.uuid(),
  taskType: z.enum(['feeding', 'medication']),
  correctedStatus: z.enum([
    'completed',
    'partial',
    'refused',
    'held',
    'missed',
    'unable',
    'adverse',
  ]),
  correctedDetails: z.string().trim().min(2).max(2000),
  reason: z.string().trim().min(5).max(2000),
  fiveRightsConfirmed: z.string().optional(),
});

export async function correctCareTaskOutcome(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || (!context.roles.includes('owner') && !context.roles.includes('manager'))) {
    redirect('/denied');
  }
  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/tasks?error=Complete+the+correction+and+reason.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('correct_care_task_outcome', {
    corrected_details: {
      five_rights_confirmed: parsed.data.fiveRightsConfirmed === 'yes',
      observation: parsed.data.correctedDetails,
    },
    corrected_status_value: parsed.data.correctedStatus,
    reason_value: parsed.data.reason,
    request_key: `care-correction-${crypto.randomUUID()}`,
    target_business_id: context.businessId,
    target_task_id: parsed.data.taskId,
  });
  if (error) redirect('/app/tasks?error=The+correction+failed+its+safety+or+permission+checks.');
  redirect('/app/tasks?notice=Correction+appended+without+rewriting+the+original+outcome.');
}
