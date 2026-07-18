'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

async function groomingContext() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_grooming')) redirect('/denied');
  return { context, supabase: await createSupabaseServerClient() };
}

export async function recordGroomingIntake(formData: FormData) {
  const parsed = z
    .object({
      executionId: z.uuid(),
      requestedStyle: z.string().trim().min(2).max(1000),
      coatCondition: z.string().trim().min(2).max(1000),
      skinCondition: z.string().trim().min(2).max(1000),
      mattingSeverity: z.enum(['none', 'mild', 'moderate', 'severe']),
      sensitivities: z.string().trim().max(1000).optional(),
      risks: z.string().trim().max(1000).optional(),
      additionalWork: z.string().trim().max(1000).optional(),
      materialChange: z.string().optional(),
      priceChange: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/grooming?error=Complete+the+structured+grooming+intake.');
  const { context, supabase } = await groomingContext();
  const { error } = await supabase.rpc('record_grooming_intake', {
    target_business_id: context.businessId,
    target_execution_id: parsed.data.executionId,
    requested_style_value: parsed.data.requestedStyle,
    coat_value: parsed.data.coatCondition,
    skin_value: parsed.data.skinCondition,
    matting_value: parsed.data.mattingSeverity,
    sensitivities_value: parsed.data.sensitivities ?? '',
    risks_value: parsed.data.risks ?? '',
    additional_work_value: parsed.data.additionalWork ?? '',
    material_change_value: parsed.data.materialChange === 'yes',
    price_change_value: parsed.data.priceChange === 'yes',
    request_key: `grooming-intake-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/grooming?error=The+intake+failed+its+service+or+safety+checks.');
  redirect('/app/grooming?notice=Grooming+intake+recorded.');
}

export async function recordGroomingAuthorization(formData: FormData) {
  const parsed = z
    .object({
      intakeId: z.uuid(),
      decision: z.enum(['approved', 'declined']),
      authorizedByName: z.string().trim().min(2).max(160),
      authorityRelationship: z.enum(['owner', 'household_member', 'authorized_agent']),
      method: z.enum(['in_person', 'phone', 'portal']),
      summary: z.string().trim().min(8).max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect('/app/grooming?error=Document+the+customer+authority+and+decision.');
  const { context, supabase } = await groomingContext();
  const { error } = await supabase.rpc('record_grooming_change_authorization', {
    target_business_id: context.businessId,
    target_intake_id: parsed.data.intakeId,
    decision_value: parsed.data.decision,
    name_value: parsed.data.authorizedByName,
    relationship_value: parsed.data.authorityRelationship,
    method_value: parsed.data.method,
    summary_value: parsed.data.summary,
    request_key: `grooming-authorization-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/grooming?error=The+authorization+could+not+be+verified.');
  redirect('/app/grooming?notice=Customer+authorization+recorded.');
}

export async function recordGroomingQualityReview(formData: FormData) {
  const parsed = z
    .object({
      executionId: z.uuid(),
      outcome: z.enum(['passed', 'rework', 'hold']),
      notes: z.string().trim().min(5).max(2000),
      styleVerified: z.literal('yes'),
      safetyVerified: z.literal('yes'),
      finishVerified: z.literal('yes'),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/grooming?error=Complete+every+quality+check.');
  const { context, supabase } = await groomingContext();
  const { error } = await supabase.rpc('record_grooming_quality_review', {
    target_business_id: context.businessId,
    target_execution_id: parsed.data.executionId,
    outcome_value: parsed.data.outcome,
    checklist_value: { style_verified: true, safety_verified: true, finish_verified: true },
    notes_value: parsed.data.notes,
    request_key: `grooming-quality-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/grooming?error=Quality+review+is+not+available+at+this+stage.');
  redirect('/app/grooming?notice=Quality+review+recorded.');
}
