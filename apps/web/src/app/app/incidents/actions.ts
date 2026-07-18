'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

async function incidentContext() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.record_incident')) redirect('/denied');
  return { context, supabase: await createSupabaseServerClient() };
}

export async function createOperationalIncident(formData: FormData) {
  const parsed = z
    .object({
      petVisitId: z.uuid(),
      executionId: z.union([z.literal(''), z.uuid()]),
      category: z.enum([
        'injury',
        'illness',
        'bite_fight',
        'escape',
        'medication',
        'feeding',
        'behavior',
        'facility',
        'customer',
        'other',
      ]),
      severity: z.enum(['information', 'minor', 'serious', 'critical']),
      occurredAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
      initialFacts: z.string().trim().min(8).max(4000),
      immediateActions: z.string().trim().min(3).max(4000),
      internalNotes: z.string().trim().max(4000).optional(),
      customerSummary: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect('/app/incidents?error=Complete+the+incident+facts+and+immediate+actions.');
  const { context, supabase } = await incidentContext();
  const { error } = await supabase.rpc('create_operational_incident', {
    target_business_id: context.businessId,
    target_pet_visit_id: parsed.data.petVisitId,
    target_execution_id: parsed.data.executionId || null,
    category_value: parsed.data.category,
    severity_value: parsed.data.severity,
    occurred_value: new Date(parsed.data.occurredAt).toISOString(),
    facts_value: parsed.data.initialFacts,
    actions_value: parsed.data.immediateActions,
    internal_value: parsed.data.internalNotes ?? '',
    customer_value: parsed.data.customerSummary ?? '',
    request_key: `incident-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/incidents?error=The+incident+failed+its+visit+or+safety+checks.');
  redirect('/app/incidents?notice=Incident+reported+and+escalated+as+required.');
}

export async function transitionOperationalIncident(formData: FormData) {
  const parsed = z
    .object({
      incidentId: z.uuid(),
      nextStatus: z.enum([
        'stabilizing',
        'monitoring',
        'escalated',
        'under_review',
        'action_required',
        'resolved',
        'closed',
      ]),
      notes: z.string().trim().min(3).max(4000),
      customerNotified: z.string().optional(),
      customerSummary: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/incidents?error=Document+the+incident+transition.');
  const { context, supabase } = await incidentContext();
  const { error } = await supabase.rpc('transition_operational_incident', {
    target_business_id: context.businessId,
    target_incident_id: parsed.data.incidentId,
    next_status: parsed.data.nextStatus,
    notes_value: parsed.data.notes,
    customer_notified_value: parsed.data.customerNotified === 'yes',
    customer_summary_value: parsed.data.customerSummary ?? '',
    request_key: `incident-transition-${crypto.randomUUID()}`,
  });
  if (error)
    redirect('/app/incidents?error=The+transition+is+not+allowed+or+requires+manager+review.');
  redirect('/app/incidents?notice=Incident+response+updated.');
}
