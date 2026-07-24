'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const serviceSchema = z.object({
  category: z.enum(['boarding', 'daycare', 'grooming', 'assessment', 'add_on']),
  confirmationMode: z.enum(['instant', 'staff_approval', 'request_only']),
  customerName: z.string().trim().min(1).max(120),
  durationMinutes: z.union([z.literal(''), z.coerce.number().int().min(5).max(1440)]),
  internalName: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().max(240),
  timeModel: z.enum([
    'overnight_date_range',
    'attendance_day',
    'fixed_appointment',
    'flexible_appointment',
    'add_on',
  ]),
});

const starterServiceSchema = z.object({
  starterServices: z.array(z.enum(['boarding', 'daycare', 'grooming', 'assessment'])).min(1),
});

const starterServiceDefaults = {
  assessment: {
    confirmationMode: 'staff_approval',
    customerName: 'Meet & Greet',
    durationMinutes: 30,
    internalName: 'Meet & Greet',
    shortDescription: 'A short introduction and care assessment before the first visit.',
    timeModel: 'fixed_appointment',
  },
  boarding: {
    confirmationMode: 'instant',
    customerName: 'Overnight Boarding',
    durationMinutes: null,
    internalName: 'Overnight Boarding',
    shortDescription: 'Safe overnight care with daily attention and updates.',
    timeModel: 'overnight_date_range',
  },
  daycare: {
    confirmationMode: 'instant',
    customerName: 'Dog Daycare',
    durationMinutes: null,
    internalName: 'Dog Daycare',
    shortDescription: 'A full day of supervised play, rest, and care.',
    timeModel: 'attendance_day',
  },
  grooming: {
    confirmationMode: 'staff_approval',
    customerName: 'Full Groom',
    durationMinutes: 120,
    internalName: 'Full Groom',
    shortDescription: 'A complete grooming appointment tailored to each pet.',
    timeModel: 'fixed_appointment',
  },
} as const;

export async function createStarterServices(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = starterServiceSchema.safeParse({
    starterServices: formData.getAll('starterServices'),
  });
  if (!parsed.success) {
    redirect('/app/settings/services?onboarding=1&error=Choose+at+least+one+service.');
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingServices, error: existingError } = await supabase
    .from('services')
    .select('category')
    .eq('business_id', context.businessId);
  if (existingError) {
    redirect('/app/settings/services?onboarding=1&error=Services+could+not+be+checked.');
  }

  const existingCategories = new Set((existingServices ?? []).map((service) => service.category));
  let createdCount = 0;

  for (const category of parsed.data.starterServices) {
    if (existingCategories.has(category)) continue;
    const defaults = starterServiceDefaults[category];
    const { error } = await supabase.rpc('create_service_draft', {
      category_value: category,
      confirmation_mode_value: defaults.confirmationMode,
      customer_name_value: defaults.customerName,
      duration_minutes: defaults.durationMinutes,
      internal_name_value: defaults.internalName,
      short_description_value: defaults.shortDescription,
      target_business_id: context.businessId,
      time_model_value: defaults.timeModel,
    });
    if (error) {
      redirect(
        '/app/settings/services?onboarding=1&error=One+or+more+services+could+not+be+created.',
      );
    }
    createdCount += 1;
  }

  const notice =
    createdCount > 0
      ? `${createdCount}+starter+service${createdCount === 1 ? '' : 's'}+created.`
      : 'Your+selected+service+types+already+exist.';
  redirect(`/app/settings/services?onboarding=1&notice=${notice}`);
}

export async function createServiceDraft(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Check+the+service+details.');
  const needsDuration = ['fixed_appointment', 'flexible_appointment'].includes(
    parsed.data.timeModel,
  );
  if (needsDuration && parsed.data.durationMinutes === '') {
    redirect('/app/settings/services?error=Appointment+services+require+a+duration.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_service_draft', {
    category_value: parsed.data.category,
    confirmation_mode_value: parsed.data.confirmationMode,
    customer_name_value: parsed.data.customerName,
    duration_minutes: parsed.data.durationMinutes === '' ? null : parsed.data.durationMinutes,
    internal_name_value: parsed.data.internalName,
    short_description_value: parsed.data.shortDescription,
    target_business_id: context.businessId,
    time_model_value: parsed.data.timeModel,
  });
  if (error) redirect('/app/settings/services?error=The+service+draft+could+not+be+created.');
  redirect('/app/settings/services?notice=Service+draft+created.');
}

const publishSchema = z.object({
  locationId: z.uuid(),
  serviceId: z.uuid(),
  versionId: z.uuid(),
});

export async function publishService(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = publishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Choose+a+valid+location.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('publish_service_version', {
    api_channel: formData.get('apiAccess') === 'on',
    portal_channel: formData.get('customerPortal') === 'on',
    staff_channel: formData.get('staffEntry') === 'on',
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    target_service_id: parsed.data.serviceId,
    target_version_id: parsed.data.versionId,
    website_channel: formData.get('publicWebsite') === 'on',
  });
  if (error) redirect('/app/settings/services?error=The+service+could+not+be+published.');
  redirect('/app/settings/services?notice=Service+published.');
}

const statusSchema = z.object({
  serviceId: z.uuid(),
  status: z.enum(['active', 'paused', 'retired']),
});

export async function changeServiceStatus(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Invalid+service+status.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_service_status', {
    new_status: parsed.data.status,
    target_business_id: context.businessId,
    target_service_id: parsed.data.serviceId,
  });
  if (error) redirect('/app/settings/services?error=The+service+status+could+not+be+changed.');
  redirect('/app/settings/services?notice=Service+status+updated.');
}

const requirementSchema = z.object({
  comparisonValue: z.string().trim().min(1).max(120),
  customerMessage: z.string().trim().min(2).max(500),
  enforcement: z.enum(['block', 'staff_review', 'warn']),
  requirementKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/),
  requirementType: z.enum([
    'vaccination',
    'daycare_evaluation',
    'minimum_age_months',
    'maximum_weight_kg',
    'document',
  ]),
  versionId: z.uuid(),
});

export async function addServiceRequirement(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = requirementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Check+the+requirement+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_service_requirement', {
    comparison_value_text: parsed.data.comparisonValue,
    customer_message_text: parsed.data.customerMessage,
    enforcement_value: parsed.data.enforcement,
    requirement_key_value: parsed.data.requirementKey,
    requirement_type_value: parsed.data.requirementType,
    target_business_id: context.businessId,
    target_service_version_id: parsed.data.versionId,
  });
  if (error) redirect('/app/settings/services?error=The+requirement+could+not+be+saved.');
  redirect('/app/settings/services?notice=Service+requirement+saved.');
}

const questionSchema = z.object({
  options: z.string().trim().max(1000),
  prompt: z.string().trim().min(2).max(300),
  questionKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/),
  responseType: z.enum([
    'short_text',
    'long_text',
    'yes_no',
    'single_select',
    'multi_select',
    'date',
    'number',
  ]),
  versionId: z.uuid(),
});

export async function addServiceQuestion(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = questionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Check+the+booking+question.');
  const options = parsed.data.options
    ? parsed.data.options
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean)
    : [];
  if (['single_select', 'multi_select'].includes(parsed.data.responseType) && !options.length) {
    redirect('/app/settings/services?error=Selection+questions+need+comma-separated+options.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_service_booking_question', {
    options_value: options,
    prompt_value: parsed.data.prompt,
    question_key_value: parsed.data.questionKey,
    required_value: formData.get('required') === 'on',
    response_type_value: parsed.data.responseType,
    target_business_id: context.businessId,
    target_service_version_id: parsed.data.versionId,
  });
  if (error) redirect('/app/settings/services?error=The+booking+question+could+not+be+saved.');
  redirect('/app/settings/services?notice=Booking+question+saved.');
}

const poolSchema = z.object({
  configuredCapacity: z.coerce.number().int().positive(),
  locationId: z.uuid(),
  model: z.enum(['pet_count', 'service_unit', 'named_resource']),
  name: z.string().trim().min(1).max(120),
  physicalMaximum: z.coerce.number().int().positive(),
  serviceId: z.uuid(),
});

export async function createCapacityPool(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('capacity.manage')) redirect('/denied');
  const parsed = poolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.configuredCapacity > parsed.data.physicalMaximum) {
    redirect('/app/settings/services?error=Check+the+capacity+limits.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('configure_capacity_pool', {
    configured_limit: parsed.data.configuredCapacity,
    model_value: parsed.data.model,
    physical_limit: parsed.data.physicalMaximum,
    pool_name: parsed.data.name,
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    target_service_id: parsed.data.serviceId,
  });
  if (error) redirect('/app/settings/services?error=The+capacity+pool+could+not+be+created.');
  redirect('/app/settings/services?notice=Capacity+pool+created.');
}

const starterCapacityEntrySchema = z.object({
  capacity: z.coerce.number().int().positive().max(10000),
  serviceId: z.uuid(),
});

export async function saveStarterCapacity(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('capacity.manage')) redirect('/denied');
  const locationId = z.uuid().safeParse(formData.get('locationId'));
  const submitted = [...formData.entries()]
    .filter(([name]) => name.startsWith('capacity:'))
    .map(([name, value]) => ({
      capacity: value,
      serviceId: name.slice('capacity:'.length),
    }));
  const entries = z.array(starterCapacityEntrySchema).min(1).safeParse(submitted);
  if (!locationId.success || !entries.success) {
    redirect('/app/settings/services?onboarding=capacity&error=Check+the+capacity+details.');
  }

  const supabase = await createSupabaseServerClient();
  const serviceIds = entries.data.map((entry) => entry.serviceId);
  const [
    { data: allowedServices, error: serviceError },
    { data: existingPools, error: poolError },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id,category,internal_name')
      .eq('business_id', context.businessId)
      .in('id', serviceIds),
    supabase
      .from('capacity_pools')
      .select('service_id')
      .eq('business_id', context.businessId)
      .eq('location_id', locationId.data)
      .eq('status', 'active')
      .in('service_id', serviceIds),
  ]);
  if (serviceError || poolError || allowedServices?.length !== new Set(serviceIds).size) {
    redirect('/app/settings/services?onboarding=capacity&error=Capacity+could+not+be+prepared.');
  }

  const servicesById = new Map((allowedServices ?? []).map((service) => [service.id, service]));
  const configuredServiceIds = new Set((existingPools ?? []).map((pool) => pool.service_id));
  let createdCount = 0;

  for (const entry of entries.data) {
    if (configuredServiceIds.has(entry.serviceId)) continue;
    const service = servicesById.get(entry.serviceId);
    if (!service) continue;
    const model =
      service.category === 'boarding' || service.category === 'daycare'
        ? 'pet_count'
        : 'service_unit';
    const { error } = await supabase.rpc('configure_capacity_pool', {
      configured_limit: entry.capacity,
      model_value: model,
      physical_limit: entry.capacity,
      pool_name: `${service.internal_name} capacity`,
      target_business_id: context.businessId,
      target_location_id: locationId.data,
      target_service_id: entry.serviceId,
    });
    if (error) {
      redirect(
        '/app/settings/services?onboarding=capacity&error=One+or+more+capacity+limits+could+not+be+saved.',
      );
    }
    createdCount += 1;
  }

  const notice =
    createdCount > 0
      ? `${createdCount}+capacity+limit${createdCount === 1 ? '' : 's'}+saved.`
      : 'Capacity+is+already+configured+for+these+services.';
  redirect(`/app/settings/services?onboarding=capacity&notice=${notice}`);
}

const overrideSchema = z.object({
  capacity: z.coerce.number().int().nonnegative(),
  endsOn: z.string().date(),
  poolId: z.uuid(),
  reason: z.string().trim().min(2).max(300),
  startsOn: z.string().date(),
});

export async function saveCapacityOverride(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('capacity.manage')) redirect('/denied');
  const parsed = overrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.endsOn < parsed.data.startsOn) {
    redirect('/app/settings/services?error=Check+the+capacity+override.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_capacity_override', {
    end_date: parsed.data.endsOn,
    override_capacity: parsed.data.capacity,
    override_reason: parsed.data.reason,
    start_date: parsed.data.startsOn,
    target_business_id: context.businessId,
    target_pool_id: parsed.data.poolId,
  });
  if (error) redirect('/app/settings/services?error=The+capacity+override+could+not+be+saved.');
  redirect('/app/settings/services?notice=Capacity+override+saved.');
}

const serviceRevisionSchema = z.object({ serviceId: z.uuid() });

export async function createServiceRevision(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.manage')) redirect('/denied');
  const parsed = serviceRevisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Invalid+service.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_service_revision', {
    target_business_id: context.businessId,
    target_service_id: parsed.data.serviceId,
  });
  if (error) redirect('/app/settings/services?error=A+draft+revision+could+not+be+created.');
  redirect('/app/settings/services?notice=Draft+revision+created+with+the+current+configuration.');
}

const resourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  maxPets: z.coerce.number().int().positive().max(20),
  poolId: z.uuid(),
  resourceCode: z.string().trim().min(1).max(60),
  resourceType: z.enum(['kennel', 'suite', 'yard', 'grooming_station', 'staff_slot', 'other']),
});

export async function addCapacityResource(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('capacity.manage')) redirect('/denied');
  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Check+the+resource+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_capacity_resource', {
    attributes_value: {},
    label_value: parsed.data.label,
    max_pets_value: parsed.data.maxPets,
    resource_code_value: parsed.data.resourceCode,
    resource_type_value: parsed.data.resourceType,
    target_business_id: context.businessId,
    target_pool_id: parsed.data.poolId,
  });
  if (error) redirect('/app/settings/services?error=The+resource+could+not+be+created.');
  redirect('/app/settings/services?notice=Capacity+resource+created.');
}

const resourceStatusSchema = z.object({
  resourceId: z.uuid(),
  status: z.enum(['ready', 'cleaning', 'maintenance', 'out_of_service', 'retired']),
});

export async function changeCapacityResourceStatus(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('capacity.manage')) redirect('/denied');
  const parsed = resourceStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/services?error=Invalid+resource+status.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_capacity_resource_status', {
    new_status: parsed.data.status,
    target_business_id: context.businessId,
    target_resource_id: parsed.data.resourceId,
  });
  if (error) redirect('/app/settings/services?error=The+resource+status+could+not+be+changed.');
  redirect('/app/settings/services?notice=Resource+status+updated.');
}
