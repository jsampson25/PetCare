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
