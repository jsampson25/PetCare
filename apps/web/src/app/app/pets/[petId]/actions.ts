'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxBytes = 10 * 1024 * 1024;
const acceptedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxPhotoBytes = 5 * 1024 * 1024;
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

const petPhotoSchema = z.object({ petId: z.uuid() });

export async function replacePetProfilePhoto(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const photo = formData.get('photo');
  const parsed = petPhotoSchema.safeParse(Object.fromEntries(formData));
  const petId = parsed.success ? parsed.data.petId : String(formData.get('petId') ?? '');
  const failurePath = z.uuid().safeParse(petId).success ? `/app/pets/${petId}` : '/app/customers';
  if (
    !parsed.success ||
    !(photo instanceof File) ||
    photo.size < 1 ||
    photo.size > maxPhotoBytes ||
    !acceptedPhotoTypes.has(photo.type)
  ) {
    redirect(`${failurePath}?error=Choose+a+JPG,+PNG,+or+WebP+photo+under+5+MB.`);
  }

  const extension =
    photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${context.businessId}/${parsed.data.petId}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from('pet-profile-photos')
    .upload(objectPath, photo, { contentType: photo.type, upsert: false });
  if (uploadError) redirect(`${failurePath}?error=The+pet+photo+could+not+be+uploaded.`);

  const { data: previousPath, error } = await supabase.rpc('replace_pet_profile_photo', {
    mime_type: photo.type,
    object_path: objectPath,
    original_file_name: photo.name,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error) {
    await supabase.storage.from('pet-profile-photos').remove([objectPath]);
    redirect(`${failurePath}?error=The+pet+photo+could+not+be+saved.`);
  }
  if (typeof previousPath === 'string' && previousPath) {
    await supabase.storage.from('pet-profile-photos').remove([previousPath]);
  }
  redirect(`${failurePath}?notice=Pet+photo+updated.`);
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

const feedingSchema = z.object({
  amountPerMeal: z.string().trim().min(1).max(120),
  feedSeparately: z.string().optional(),
  foodName: z.string().trim().min(1).max(200),
  foodSource: z.enum(['customer_provided', 'business_provided']),
  informationSource: z.enum(['customer_reported', 'staff_confirmed', 'veterinary_documented']),
  mealsPerDay: z.coerce.number().int().min(1).max(8),
  petId: z.uuid(),
  preparationInstructions: z.string().trim().min(1).max(1000),
  scheduleDescription: z.string().trim().min(1).max(500),
  separateFeedingReason: z.string().trim().max(500),
  supplementInstructions: z.string().trim().max(1000),
});

export async function addPetFeedingPlan(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = feedingSchema.safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    (parsed.data.feedSeparately === 'on' && !parsed.data.separateFeedingReason)
  ) {
    redirect('/app/customers?error=Check+the+feeding+plan+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_feeding_plan', {
    daily_meal_count: parsed.data.mealsPerDay,
    food_product: parsed.data.foodName,
    information_source_type: parsed.data.informationSource,
    meal_amount: parsed.data.amountPerMeal,
    preparation_text: parsed.data.preparationInstructions,
    requires_separate_feeding: parsed.data.feedSeparately === 'on',
    schedule_text: parsed.data.scheduleDescription,
    separation_reason: parsed.data.separateFeedingReason,
    source_type: parsed.data.foodSource,
    supplement_text: parsed.data.supplementInstructions,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+feeding+plan+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Feeding+plan+added.`);
}

const discontinueFeedingSchema = z.object({
  feedingPlanId: z.uuid(),
  petId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export async function discontinuePetFeedingPlan(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = discontinueFeedingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+discontinuation+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('discontinue_pet_feeding_plan', {
    feeding_plan_id: parsed.data.feedingPlanId,
    reason: parsed.data.reason,
    target_business_id: context.businessId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+feeding+plan+could+not+be+discontinued.`);
  redirect(
    `/app/pets/${parsed.data.petId}?notice=Feeding+plan+discontinued+with+history+preserved.`,
  );
}

const behaviorSchema = z.object({
  behaviorType: z.enum([
    'aggression',
    'bite_history',
    'escape_risk',
    'severe_anxiety',
    'resource_guarding',
    'dog_interaction',
    'human_interaction',
    'handling_sensitivity',
    'barrier_reactivity',
    'other',
  ]),
  calmingStrategies: z.string().trim().max(1000),
  contextDescription: z.string().trim().min(1).max(1000),
  groupPlayGuidance: z.enum(['not_evaluated', 'approved', 'conditional', 'not_approved']),
  informationSource: z.enum(['customer_reported', 'staff_observed', 'veterinary_documented']),
  observedOn: z.union([z.literal(''), z.string().date()]),
  petId: z.uuid(),
  preferredHandling: z.string().trim().min(1).max(1000),
  prohibitedApproaches: z.string().trim().max(1000),
  severity: z.enum(['information', 'caution', 'high', 'critical']),
  triggers: z.string().trim().max(1000),
});

export async function addPetBehaviorRecord(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = behaviorSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed.success || (parsed.data.observedOn && parsed.data.observedOn > today)) {
    redirect('/app/customers?error=Check+the+behavior+and+handling+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_behavior_record', {
    calming_text: parsed.data.calmingStrategies,
    context_text: parsed.data.contextDescription,
    handling_text: parsed.data.preferredHandling,
    observation_date: parsed.data.observedOn || null,
    play_guidance: parsed.data.groupPlayGuidance,
    prohibited_text: parsed.data.prohibitedApproaches,
    record_type: parsed.data.behaviorType,
    risk_severity: parsed.data.severity,
    source_type: parsed.data.informationSource,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
    trigger_text: parsed.data.triggers,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+behavior+record+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Behavior+and+handling+record+added.`);
}

const resolveBehaviorSchema = z.object({
  behaviorRecordId: z.uuid(),
  petId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export async function resolvePetBehaviorRecord(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = resolveBehaviorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+resolution+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('resolve_pet_behavior_record', {
    behavior_record_id: parsed.data.behaviorRecordId,
    reason: parsed.data.reason,
    target_business_id: context.businessId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+behavior+record+could+not+be+resolved.`);
  redirect(
    `/app/pets/${parsed.data.petId}?notice=Behavior+record+resolved+with+history+preserved.`,
  );
}

const healthConditionSchema = z.object({
  careImpact: z.string().trim().min(1).max(1000),
  category: z.enum([
    'cardiac',
    'respiratory',
    'neurological',
    'seizure',
    'mobility',
    'sensory',
    'digestive',
    'endocrine',
    'skin_coat',
    'immune',
    'post_surgical',
    'other',
  ]),
  conditionName: z.string().trim().min(1).max(200),
  diagnosedOn: z.union([z.literal(''), z.string().date()]),
  emergencyInstructions: z.string().trim().max(1000),
  informationSource: z.enum(['customer_reported', 'staff_observed', 'veterinary_documented']),
  petId: z.uuid(),
  severity: z.enum(['mild', 'moderate', 'severe', 'critical']),
});

export async function addPetHealthCondition(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = healthConditionSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (
    !parsed.success ||
    (parsed.data.diagnosedOn && parsed.data.diagnosedOn > today) ||
    (['severe', 'critical'].includes(parsed.data.severity) && !parsed.data.emergencyInstructions)
  ) {
    redirect('/app/customers?error=Check+the+health+condition+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_health_condition', {
    care_impact_text: parsed.data.careImpact,
    condition_category: parsed.data.category,
    condition_severity: parsed.data.severity,
    diagnosis_date: parsed.data.diagnosedOn || null,
    emergency_instruction_text: parsed.data.emergencyInstructions,
    health_condition_name: parsed.data.conditionName,
    source_type: parsed.data.informationSource,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+health+condition+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Health+condition+added.`);
}

const resolveHealthSchema = z.object({
  healthConditionId: z.uuid(),
  petId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export async function resolvePetHealthCondition(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = resolveHealthSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+resolution+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('resolve_pet_health_condition', {
    health_condition_id: parsed.data.healthConditionId,
    reason: parsed.data.reason,
    target_business_id: context.businessId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+health+condition+could+not+be+resolved.`);
  redirect(
    `/app/pets/${parsed.data.petId}?notice=Health+condition+resolved+with+history+preserved.`,
  );
}

const petIdentifierSchema = z.object({
  expiresOn: z.union([z.literal(''), z.string().date()]),
  identifierType: z.enum(['microchip', 'license', 'registration', 'other']),
  identifierValue: z.string().trim().min(1).max(200),
  issuedOn: z.union([z.literal(''), z.string().date()]),
  issuer: z.string().trim().max(200),
  petId: z.uuid(),
});

export async function addPetIdentifier(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = petIdentifierSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (
    !parsed.success ||
    !/[a-z0-9]/i.test(parsed.data.identifierValue) ||
    (parsed.data.issuedOn && parsed.data.issuedOn > today) ||
    (parsed.data.expiresOn && parsed.data.issuedOn && parsed.data.expiresOn < parsed.data.issuedOn)
  ) {
    redirect('/app/customers?error=Check+the+pet+identifier+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_identifier', {
    expiration_date: parsed.data.expiresOn || null,
    identifier_kind: parsed.data.identifierType,
    identifier_text: parsed.data.identifierValue,
    issue_date: parsed.data.issuedOn || null,
    issuer_name: parsed.data.issuer,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error)
    redirect(
      `/app/pets/${parsed.data.petId}?error=The+identifier+could+not+be+saved.+Check+for+a+duplicate.`,
    );
  redirect(`/app/pets/${parsed.data.petId}?notice=Pet+identifier+added.`);
}

const retireIdentifierSchema = z.object({
  petId: z.uuid(),
  petIdentifierId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export async function retirePetIdentifier(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = retireIdentifierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+retirement+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('retire_pet_identifier', {
    pet_identifier_id: parsed.data.petIdentifierId,
    reason: parsed.data.reason,
    target_business_id: context.businessId,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+identifier+could+not+be+retired.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Pet+identifier+retired+with+history+preserved.`);
}

const createEvaluationSchema = z.object({
  evaluationType: z.literal('daycare_group_play'),
  petId: z.uuid(),
  scheduledFor: z.union([z.literal(''), z.string().date()]),
});

export async function createPetServiceEvaluation(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = createEvaluationSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed.success || (parsed.data.scheduledFor && parsed.data.scheduledFor < today)) {
    redirect('/app/customers?error=Check+the+evaluation+request.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_pet_service_evaluation', {
    evaluation_kind: parsed.data.evaluationType,
    scheduled_date: parsed.data.scheduledFor || null,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error)
    redirect(
      `/app/pets/${parsed.data.petId}?error=The+evaluation+could+not+be+requested.+Check+for+an+existing+pending+evaluation.`,
    );
  redirect(`/app/pets/${parsed.data.petId}?notice=Service+evaluation+requested.`);
}

const transitionEvaluationSchema = z.object({
  conditions: z.string().trim().max(2000),
  evaluationId: z.uuid(),
  expiresOn: z.union([z.literal(''), z.string().date()]),
  nextStatus: z.enum(['approved', 'conditional', 'suspended', 'failed', 'expired']),
  petId: z.uuid(),
  reason: z.string().trim().min(1).max(2000),
});

export async function transitionPetServiceEvaluation(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = transitionEvaluationSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (
    !parsed.success ||
    (parsed.data.nextStatus === 'conditional' && !parsed.data.conditions) ||
    (['approved', 'conditional'].includes(parsed.data.nextStatus) &&
      parsed.data.expiresOn &&
      parsed.data.expiresOn < today)
  ) {
    redirect('/app/customers?error=Check+the+evaluation+decision.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_pet_service_evaluation', {
    condition_text: parsed.data.conditions,
    expiration_date: parsed.data.expiresOn || null,
    next_status: parsed.data.nextStatus,
    service_evaluation_id: parsed.data.evaluationId,
    target_business_id: context.businessId,
    transition_reason: parsed.data.reason,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=That+evaluation+transition+is+not+available.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Service+evaluation+updated.`);
}

const petIdentitySchema = z.object({
  alteredStatus: z.enum(['altered', 'intact', 'unknown']),
  birthDate: z.union([z.literal(''), z.string().date()]),
  birthDateEstimated: z.string().optional(),
  breed: z.string().trim().min(1).max(120),
  colorMarkings: z.string().trim().max(300),
  name: z.string().trim().min(1).max(100),
  petId: z.uuid(),
  preferredName: z.string().trim().max(100),
  sex: z.enum(['female', 'male', 'unknown']),
});

export async function updatePetIdentity(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = petIdentitySchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (
    !parsed.success ||
    (parsed.data.birthDate && parsed.data.birthDate > today) ||
    (!parsed.data.birthDate && parsed.data.birthDateEstimated)
  ) {
    redirect('/app/customers?error=Check+the+pet+identity+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('update_pet_identity', {
    alteration_value: parsed.data.alteredStatus,
    birth_date_estimated: Boolean(parsed.data.birthDateEstimated),
    breed_text: parsed.data.breed,
    color_markings_text: parsed.data.colorMarkings,
    date_of_birth: parsed.data.birthDate || null,
    legal_name: parsed.data.name,
    preferred_name_text: parsed.data.preferredName,
    sex_value: parsed.data.sex,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+pet+identity+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Pet+identity+updated.`);
}

const petWeightSchema = z.object({
  measuredOn: z.string().date(),
  note: z.string().trim().max(500),
  petId: z.uuid(),
  source: z.enum(['customer_reported', 'staff_measured', 'veterinary_documented']),
  weightUnit: z.enum(['lb', 'kg']),
  weightValue: z.coerce.number().positive(),
});

export async function addPetWeightRecord(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = petWeightSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed.success || parsed.data.measuredOn > today) {
    redirect('/app/customers?error=Check+the+pet+weight+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_weight_record', {
    measurement_date: parsed.data.measuredOn,
    note_text: parsed.data.note,
    source_type: parsed.data.source,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
    weight_unit: parsed.data.weightUnit,
    weight_value: parsed.data.weightValue,
  });
  if (error) redirect(`/app/pets/${parsed.data.petId}?error=The+pet+weight+could+not+be+saved.`);
  redirect(`/app/pets/${parsed.data.petId}?notice=Pet+weight+recorded.`);
}

const veterinaryContactSchema = z
  .object({
    address: z.string().trim().max(500),
    clinicName: z.string().trim().min(1).max(200),
    email: z.union([z.literal(''), z.email()]),
    isEmergency: z.string().optional(),
    isPrimary: z.string().optional(),
    notes: z.string().trim().max(1000),
    petId: z.uuid(),
    phone: z.string().trim().min(7).max(40),
    source: z.enum(['customer_reported', 'staff_confirmed', 'veterinary_documented']),
    veterinarianName: z.string().trim().max(200),
  })
  .refine((value) => value.isPrimary || value.isEmergency);

export async function addPetVeterinaryContact(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = veterinaryContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=Check+the+veterinary+contact+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_pet_veterinary_contact', {
    clinic: parsed.data.clinicName,
    email_address: parsed.data.email,
    emergency_contact: Boolean(parsed.data.isEmergency),
    note_text: parsed.data.notes,
    phone_number: parsed.data.phone,
    primary_contact: Boolean(parsed.data.isPrimary),
    source_type: parsed.data.source,
    street_address: parsed.data.address,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
    veterinarian: parsed.data.veterinarianName,
  });
  if (error)
    redirect(
      `/app/pets/${parsed.data.petId}?error=The+veterinary+contact+could+not+be+saved.+Retire+an+existing+contact+with+the+same+role+first.`,
    );
  redirect(`/app/pets/${parsed.data.petId}?notice=Veterinary+contact+added.`);
}

const retireVeterinaryContactSchema = z.object({
  petId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
  veterinaryContactId: z.uuid(),
});

export async function retirePetVeterinaryContact(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = retireVeterinaryContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/customers?error=A+retirement+reason+is+required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('retire_pet_veterinary_contact', {
    reason: parsed.data.reason,
    target_business_id: context.businessId,
    veterinary_contact_id: parsed.data.veterinaryContactId,
  });
  if (error)
    redirect(`/app/pets/${parsed.data.petId}?error=The+veterinary+contact+could+not+be+retired.`);
  redirect(
    `/app/pets/${parsed.data.petId}?notice=Veterinary+contact+retired+with+history+preserved.`,
  );
}

const groomingProfileSchema = z.object({
  changeReason: z.string().trim().max(1000),
  coatCondition: z.enum(['healthy', 'matted', 'dry', 'oily', 'sensitive', 'unknown']),
  coatType: z.enum(['short', 'double', 'long', 'curly', 'wire', 'hairless', 'mixed', 'unknown']),
  earCleaning: z.string().optional(),
  handlingConstraints: z.string().trim().max(1000),
  nailService: z.enum(['no_preference', 'trim', 'grind', 'decline']),
  petId: z.uuid(),
  preferredGroomer: z.string().trim().max(200),
  preferredLength: z.string().trim().max(200),
  sensitivityDetails: z.string().trim().max(1000),
  sensitivityLevel: z.enum(['none', 'low', 'moderate', 'high']),
  source: z.enum(['customer_reported', 'staff_confirmed', 'groomer_observed']),
  styleNotes: z.string().trim().max(1000),
  teethBrushing: z.string().optional(),
});

export async function replacePetGroomingProfile(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.manage_care')) redirect('/denied');
  const parsed = groomingProfileSchema.safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    (parsed.data.sensitivityLevel !== 'none' && !parsed.data.sensitivityDetails)
  ) {
    redirect('/app/customers?error=Check+the+grooming+profile+details.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('replace_pet_grooming_profile', {
    change_reason: parsed.data.changeReason,
    coat_condition_value: parsed.data.coatCondition,
    coat_type_value: parsed.data.coatType,
    handling_constraint_text: parsed.data.handlingConstraints,
    include_ear_cleaning: Boolean(parsed.data.earCleaning),
    include_teeth_brushing: Boolean(parsed.data.teethBrushing),
    nail_service_value: parsed.data.nailService,
    preferred_groomer_text: parsed.data.preferredGroomer,
    preferred_length_text: parsed.data.preferredLength,
    sensitivity_text: parsed.data.sensitivityDetails,
    sensitivity_value: parsed.data.sensitivityLevel,
    source_type: parsed.data.source,
    style_note_text: parsed.data.styleNotes,
    target_business_id: context.businessId,
    target_pet_id: parsed.data.petId,
  });
  if (error)
    redirect(
      `/app/pets/${parsed.data.petId}?error=The+grooming+profile+could+not+be+saved.+Existing+profiles+require+a+change+reason.`,
    );
  redirect(`/app/pets/${parsed.data.petId}?notice=Grooming+profile+saved.`);
}
