'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const taskSchema = z.object({ taskId: z.uuid() });

async function turnoverContext(permission: string) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has(permission)) redirect('/denied');
  return { context, supabase: await createSupabaseServerClient() };
}

export async function startTurnover(formData: FormData) {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/turnover?error=The+turnover+task+is+invalid.');
  const { context, supabase } = await turnoverContext('operations.clean_resources');
  const { error } = await supabase.rpc('start_resource_turnover', {
    request_key: `turnover-start-${parsed.data.taskId}`,
    target_business_id: context.businessId,
    target_task_id: parsed.data.taskId,
  });
  if (error) redirect('/app/turnover?error=Cleaning+could+not+be+started.');
  redirect('/app/turnover?notice=Cleaning+started.');
}

export async function completeCleaning(formData: FormData) {
  const parsed = taskSchema
    .extend({ protocol: z.string().trim().min(3).max(200), notes: z.string().trim().max(1000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/turnover?error=Complete+the+cleaning+protocol.');
  const { context, supabase } = await turnoverContext('operations.clean_resources');
  const checklist = Object.fromEntries(
    ['debris_removed', 'washed', 'disinfected', 'dry', 'setup_reset'].map((key) => [
      key,
      formData.get(key) === 'yes',
    ]),
  );
  const { error } = await supabase.rpc('complete_resource_cleaning', {
    checklist_value: checklist,
    notes_value: parsed.data.notes,
    protocol_value: parsed.data.protocol,
    request_key: `turnover-clean-${parsed.data.taskId}`,
    target_business_id: context.businessId,
    target_task_id: parsed.data.taskId,
  });
  if (error) redirect('/app/turnover?error=Every+cleaning+step+must+be+confirmed.');
  redirect('/app/turnover?notice=Cleaning+complete+and+inspection+required.');
}

export async function inspectTurnover(formData: FormData) {
  const parsed = taskSchema
    .extend({ result: z.enum(['passed', 'failed']), notes: z.string().trim().min(3).max(1000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/turnover?error=Document+the+inspection+result.');
  const { context, supabase } = await turnoverContext('operations.inspect_resources');
  const checklist = Object.fromEntries(
    ['visibly_clean', 'dry', 'odor_free', 'safe', 'setup_correct'].map((key) => [
      key,
      formData.get(key) === 'yes',
    ]),
  );
  const { error } = await supabase.rpc('inspect_resource_turnover', {
    checklist_value: checklist,
    notes_value: parsed.data.notes,
    passed_value: parsed.data.result === 'passed',
    request_key: `turnover-inspect-${parsed.data.taskId}-${parsed.data.result}`,
    target_business_id: context.businessId,
    target_task_id: parsed.data.taskId,
  });
  if (error) redirect('/app/turnover?error=Inspection+could+not+be+recorded.');
  redirect(
    `/app/turnover?notice=${parsed.data.result === 'passed' ? 'Resource+released+as+ready.' : 'Inspection+failed+and+recleaning+is+required.'}`,
  );
}
