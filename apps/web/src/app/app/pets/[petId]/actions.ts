'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxBytes = 10 * 1024 * 1024;
const vaccinationSchema = z.object({
  administeredOn: z.union([z.literal(''), z.string().date()]),
  expiresOn: z.string().date(),
  petId: z.uuid(),
  providerName: z.string().trim().max(160),
  vaccineType: z.enum([
    'rabies',
    'dhpp',
    'bordetella',
    'canine_influenza',
    'leptospirosis',
    'other',
  ]),
});

export async function submitPetVaccination(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const evidence = formData.get('evidence');
  const parsed = vaccinationSchema.safeParse(Object.fromEntries(formData));
  const petId = parsed.success ? parsed.data.petId : String(formData.get('petId') ?? '');
  const failurePath = z.uuid().safeParse(petId).success ? `/app/pets/${petId}` : '/app/customers';
  if (
    !parsed.success ||
    !(evidence instanceof File) ||
    evidence.size < 1 ||
    evidence.size > maxBytes ||
    !acceptedTypes.has(evidence.type) ||
    (parsed.data.administeredOn && parsed.data.administeredOn > parsed.data.expiresOn)
  ) {
    redirect(`${failurePath}?error=Check+the+vaccination+dates+and+evidence+file.`);
  }

  const supabase = await createSupabaseServerClient();
  const extension =
    evidence.type === 'application/pdf' ? 'pdf' : evidence.type === 'image/png' ? 'png' : 'jpg';
  const objectPath = `${context.businessId}/${parsed.data.petId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('pet-vaccine-evidence')
    .upload(objectPath, evidence, { contentType: evidence.type, upsert: false });
  if (uploadError) redirect(`${failurePath}?error=The+evidence+file+could+not+be+uploaded.`);

  const { error } = await supabase.rpc('submit_pet_vaccination', {
    administered_date: parsed.data.administeredOn || null,
    expiration_date: parsed.data.expiresOn,
    mime_type: evidence.type,
    object_path: objectPath,
    original_file_name: evidence.name,
    provider: parsed.data.providerName,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
    vaccination_type: parsed.data.vaccineType,
  });
  if (error) {
    await supabase.storage.from('pet-vaccine-evidence').remove([objectPath]);
    redirect(`${failurePath}?error=The+vaccination+record+could+not+be+saved.`);
  }
  redirect(`${failurePath}?notice=Vaccination+evidence+submitted+for+review.`);
}

const reviewSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  petId: z.uuid(),
  reason: z.string().trim().max(500),
  vaccinationId: z.uuid(),
});

export async function reviewPetVaccination(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || (parsed.data.decision === 'rejected' && !parsed.data.reason)) {
    redirect('/app/customers?error=Check+the+vaccination+review.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('review_pet_vaccination', {
    decision: parsed.data.decision,
    reason: parsed.data.reason,
    target_business_id: context.businessId,
    vaccination_id: parsed.data.vaccinationId,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+review+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Vaccination+review+saved.`);
}

const allergySchema = z.object({
  allergen: z.string().trim().min(1).max(160),
  careInstructions: z.string().trim().min(1).max(1000),
  category: z.enum(['food', 'medication', 'environmental', 'contact', 'other']),
  petId: z.uuid(),
  reaction: z.string().trim().min(1).max(500),
  severity: z.enum(['mild', 'moderate', 'severe', 'life_threatening']),
  source: z.enum(['customer_reported', 'staff_observed', 'veterinary_documented']),
});

export async function addPetAllergy(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = allergySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=Check+the+allergy+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_allergy', {
    allergen_name: parsed.data.allergen,
    allergy_category: parsed.data.category,
    allergy_severity: parsed.data.severity,
    handling_instructions: parsed.data.careInstructions,
    reaction_description: parsed.data.reaction,
    source_type: parsed.data.source,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+allergy+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Allergy+safety+record+added.`);
}

const resolutionSchema = z.object({
  allergyId: z.uuid(),
  petId: z.uuid(),
  resolutionReason: z.string().trim().min(1).max(1000),
});

export async function resolvePetAllergy(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = resolutionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+resolution+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('resolve_pet_allergy', {
    allergy_id: parsed.data.allergyId,
    resolution_reason: parsed.data.resolutionReason,
    target_business_id: context.businessId,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+allergy+could+not+be+resolved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Allergy+record+resolved+with+history+preserved.`);
}

const medicationSchema = z.object({
  administrationInstructions: z.string().trim().min(1).max(1000),
  asNeeded: z.string().optional(),
  asNeededReason: z.string().trim().max(500),
  dose: z.string().trim().min(1).max(120),
  endsOn: z.union([z.literal(''), z.string().date()]),
  medicationName: z.string().trim().min(1).max(160),
  petId: z.uuid(),
  route: z.enum(['oral', 'topical', 'otic', 'ophthalmic', 'inhaled', 'injection', 'other']),
  scheduleDescription: z.string().trim().min(1).max(500),
  source: z.enum(['customer_reported', 'staff_confirmed', 'veterinary_documented']),
  startsOn: z.union([z.literal(''), z.string().date()]),
});

export async function addPetMedicationPlan(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = medicationSchema.safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    (parsed.data.asNeeded === 'on' && !parsed.data.asNeededReason) ||
    (parsed.data.endsOn && parsed.data.startsOn && parsed.data.endsOn < parsed.data.startsOn)
  ) {
    redirect('/app/customers?error=Check+the+medication+plan+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_medication_plan', {
    administration_route: parsed.data.route,
    as_needed_indication: parsed.data.asNeededReason,
    effective_end: parsed.data.endsOn || null,
    effective_start: parsed.data.startsOn || null,
    instruction_text: parsed.data.administrationInstructions,
    is_as_needed: parsed.data.asNeeded === 'on',
    medication: parsed.data.medicationName,
    medication_dose: parsed.data.dose,
    schedule_text: parsed.data.scheduleDescription,
    source_type: parsed.data.source,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+medication+plan+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Medication+plan+added.`);
}

const discontinueMedicationSchema = z.object({
  medicationPlanId: z.uuid(),
  petId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export async function discontinuePetMedicationPlan(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = discontinueMedicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+discontinuation+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('discontinue_pet_medication_plan', {
    medication_plan_id: parsed.data.medicationPlanId,
    reason: parsed.data.reason,
    target_business_id: context.businessId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+medication+plan+could+not+be+discontinued.`);
  redirect(
    `/app/pets/${parsed.data.petId}?notice=Medication+plan+discontinued+with+history+preserved.`,
  );
}
