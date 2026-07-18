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
