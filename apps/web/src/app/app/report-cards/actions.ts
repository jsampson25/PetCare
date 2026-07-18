'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
async function reportContext() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_report_cards')) redirect('/denied');
  return { context, supabase: await createSupabaseServerClient() };
}
export async function createReportCardDraft(formData: FormData) {
  const parsed = z
    .object({
      executionId: z.uuid(),
      narrative: z.string().trim().min(8).max(4000),
      mood: z.string().trim().min(2).max(100),
      favoriteActivity: z.string().trim().max(500).optional(),
      careHighlight: z.string().trim().max(500).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/report-cards?error=Complete+the+customer-safe+draft.');
  const { context, supabase } = await reportContext();
  const { error } = await supabase.rpc('create_report_card_draft', {
    target_business_id: context.businessId,
    target_execution_id: parsed.data.executionId,
    narrative_value: parsed.data.narrative,
    highlights_value: {
      mood: parsed.data.mood,
      favorite_activity: parsed.data.favoriteActivity ?? '',
      care_highlight: parsed.data.careHighlight ?? '',
    },
    request_key: `report-card-${crypto.randomUUID()}`,
  });
  if (error) redirect('/app/report-cards?error=The+service+is+not+ready+for+a+report+card.');
  redirect('/app/report-cards?notice=Report+card+drafted+from+authorized+facts.');
}
export async function transitionReportCard(formData: FormData) {
  const parsed = z
    .object({
      reportCardId: z.uuid(),
      nextStatus: z.enum(['review', 'approved', 'published']),
      notes: z.string().trim().max(1000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/report-cards?error=Choose+a+valid+review+step.');
  const { context, supabase } = await reportContext();
  const { error } = await supabase.rpc('transition_report_card', {
    target_business_id: context.businessId,
    target_report_card_id: parsed.data.reportCardId,
    next_status: parsed.data.nextStatus,
    notes_value: parsed.data.notes ?? '',
    request_key: `report-card-state-${crypto.randomUUID()}`,
  });
  if (error)
    redirect('/app/report-cards?error=That+review+step+requires+the+correct+role+and+prior+state.');
  redirect('/app/report-cards?notice=Report+card+status+updated.');
}
export async function startReportCardCorrection(formData: FormData) {
  const parsed = z
    .object({
      reportCardId: z.uuid(),
      narrative: z.string().trim().min(8).max(4000),
      mood: z.string().trim().min(2).max(100),
      reason: z.string().trim().min(8).max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect('/app/report-cards?error=Complete+the+corrected+version+and+reason.');
  const { context, supabase } = await reportContext();
  const { error } = await supabase.rpc('start_report_card_correction', {
    target_business_id: context.businessId,
    target_report_card_id: parsed.data.reportCardId,
    narrative_value: parsed.data.narrative,
    highlights_value: { mood: parsed.data.mood },
    reason_value: parsed.data.reason,
    request_key: `report-card-correction-${crypto.randomUUID()}`,
  });
  if (error)
    redirect('/app/report-cards?error=Only+a+manager+can+correct+a+published+report+card.');
  redirect('/app/report-cards?notice=Correction+version+created+for+review.');
}
