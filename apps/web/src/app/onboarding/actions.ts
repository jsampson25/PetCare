'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { businessContextCookie, resolveBusinessContext } from '../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export type CreateBusinessState = { error?: string };

const slugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const createSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  businessSlug: slugSchema,
  locationName: z.string().trim().min(2).max(160),
  locationSlug: slugSchema,
  timeZone: z.string().min(1).max(80),
});

function normalizeWebName(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.(com|net|org|co|io)(?:\/.*)?$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function createFirstBusiness(
  _previousState: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const values = Object.fromEntries(formData);
  const parsed = createSchema.safeParse({
    ...values,
    businessSlug: normalizeWebName(formData.get('businessSlug')),
    locationSlug: normalizeWebName(formData.get('locationSlug')),
  });
  if (!parsed.success || !validTimeZone(parsed.data.timeZone)) {
    return { error: 'Check the business name, web address, location, and time zone.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('app').rpc('create_business_with_owner', {
    business_name: parsed.data.businessName,
    business_slug: parsed.data.businessSlug,
    first_location_name: parsed.data.locationName,
    first_location_slug: parsed.data.locationSlug,
    first_location_time_zone: parsed.data.timeZone,
  });
  let businessId = data?.[0]?.business_id as string | undefined;
  if (error || !businessId) {
    const { data: existing } = await supabase
      .from('businesses')
      .select('id')
      .eq('public_slug', parsed.data.businessSlug)
      .maybeSingle();
    businessId = existing?.id;
    if (!businessId)
      return { error: 'This business could not be created. Try a different web address.' };
  }

  const { data: existingWebsite } = await supabase
    .from('tenant_websites')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle();
  if (!existingWebsite) {
    const { error: websiteError } = await supabase
      .schema('app')
      .rpc('bootstrap_tenant_website_draft', {
        target_business_id: businessId,
        theme_value: 'modern',
        brand_value: { primary: '#5b35e8', accent: '#f3a712' },
        content_value: {
          hero_title: `Exceptional care for every pet`,
          hero_body: `${parsed.data.businessName} makes boarding, daycare, and grooming feel simple, safe, and personal.`,
          about: `Welcome to ${parsed.data.businessName}. Tell customers what makes your team, facility, and approach to care special.`,
          faqs: [
            {
              question: 'What should I bring for my pet?',
              answer: 'Add your preferred preparation instructions and required items here.',
            },
          ],
          policies: 'Add your vaccination, cancellation, arrival, and pickup policies here.',
          contact_email: emailFromClaims(await supabase.auth.getClaims()),
          contact_phone: '555-555-0100',
          seo_title: `${parsed.data.businessName} | Pet care`,
          seo_description: `Boarding, daycare, and grooming from ${parsed.data.businessName}.`,
          section_layout: [
            { id: 'services', visible: true },
            { id: 'about', visible: true },
            { id: 'faq', visible: true },
            { id: 'contact', visible: true },
          ],
          custom_pages: [],
        },
      });
    if (websiteError) {
      return {
        error: 'Your business was created, but its website draft could not be prepared. Try again.',
      };
    }
  }

  const claimsResult = await supabase.auth.getClaims();
  const metadata = claimsResult.data?.claims?.user_metadata;
  const requestedPlan =
    metadata && typeof metadata === 'object' && 'requested_plan' in metadata
      ? metadata.requested_plan
      : undefined;
  const requestedTrialDays =
    metadata && typeof metadata === 'object' && 'requested_trial_days' in metadata
      ? metadata.requested_trial_days
      : undefined;

  if (requestedTrialDays === 14 && (requestedPlan === 'starter' || requestedPlan === 'growth')) {
    const { error: trialError } = await supabase.schema('app').rpc('start_owner_saas_trial', {
      requested_plan_key: requestedPlan,
      target_business_id: businessId,
    });
    if (trialError) {
      return {
        error: 'Your business was created, but its free trial could not be started. Try again.',
      };
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(businessContextCookie, businessId, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/auth/mfa?next=/onboarding/setup');
}

function emailFromClaims(
  result: Awaited<
    ReturnType<Awaited<ReturnType<typeof createSupabaseServerClient>>['auth']['getClaims']>
  >,
) {
  const email = result.data?.claims?.email;
  return typeof email === 'string' && email.includes('@') ? email : 'hello@example.com';
}

const profileSchema = z.object({
  addressLine1: z.string().trim().min(2).max(160),
  addressLine2: z.string().trim().max(160),
  city: z.string().trim().min(1).max(100),
  countryCode: z.enum(['CA', 'US']),
  currencyCode: z.enum(['CAD', 'USD']),
  customerEmail: z.email().max(320),
  customerPhone: z.string().trim().min(7).max(30),
  legalName: z.string().trim().min(2).max(200),
  locale: z.enum(['en-CA', 'en-US']),
  locationId: z.uuid(),
  postalCode: z.string().trim().min(2).max(20),
  region: z.string().trim().min(1).max(100),
  timeZone: z.string().min(1).max(80),
  weekdayClose: z.string().regex(/^\d{2}:\d{2}$/),
  weekdayOpen: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function saveOnboardingSetup(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('business.manage_profile')) redirect('/denied');
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    !validTimeZone(parsed.data.timeZone) ||
    parsed.data.weekdayOpen >= parsed.data.weekdayClose
  ) {
    redirect(
      '/onboarding/setup?error=Check+the+required+profile,+address,+time+zone,+and+hours+fields.',
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('business_id', context.businessId)
    .eq('id', parsed.data.locationId)
    .maybeSingle();
  if (!location) redirect('/denied');

  const { error } = await supabase.rpc('save_business_onboarding_foundation', {
    target_address_line_1: parsed.data.addressLine1,
    target_address_line_2: parsed.data.addressLine2,
    target_business_id: context.businessId,
    target_city: parsed.data.city,
    target_country_code: parsed.data.countryCode,
    target_currency_code: parsed.data.currencyCode,
    target_customer_email: parsed.data.customerEmail,
    target_customer_phone: parsed.data.customerPhone,
    target_legal_name: parsed.data.legalName,
    target_locale: parsed.data.locale,
    target_location_id: location.id,
    target_postal_code: parsed.data.postalCode,
    target_region: parsed.data.region,
    target_time_zone: parsed.data.timeZone,
    target_weekday_close: parsed.data.weekdayClose,
    target_weekday_open: parsed.data.weekdayOpen,
  });

  if (error) {
    redirect('/onboarding/setup?error=Setup+could+not+be+saved.+Review+the+details+and+try+again.');
  }
  redirect('/onboarding/setup?notice=Business,+location,+and+hours+saved.');
}

const customerWindowsSchema = z.object({
  arrivalEnd: z.string().regex(/^\d{2}:\d{2}$/),
  arrivalStart: z.string().regex(/^\d{2}:\d{2}$/),
  locationId: z.uuid(),
  pickupEnd: z.string().regex(/^\d{2}:\d{2}$/),
  pickupStart: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function saveLocationCustomerWindows(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('business.manage_locations')) redirect('/denied');
  const parsed = customerWindowsSchema.safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    parsed.data.arrivalStart >= parsed.data.arrivalEnd ||
    parsed.data.pickupStart >= parsed.data.pickupEnd
  ) {
    redirect('/onboarding/setup?error=Check+the+arrival+and+pickup+time+windows.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_location_customer_windows', {
    target_arrival_end: parsed.data.arrivalEnd,
    target_arrival_start: parsed.data.arrivalStart,
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    target_pickup_end: parsed.data.pickupEnd,
    target_pickup_start: parsed.data.pickupStart,
  });

  if (error) {
    redirect(
      '/onboarding/setup?error=Customer+windows+must+be+valid+and+fit+inside+regular+operating+hours.',
    );
  }
  redirect('/onboarding/setup?notice=Customer+arrival+and+pickup+windows+saved.');
}

const closureSchema = z.object({
  closureDate: z.string().date(),
  customerMessage: z.string().trim().max(500),
  locationId: z.uuid(),
  reason: z.string().trim().min(2).max(200),
});

export async function saveLocationClosure(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('business.manage_locations')) redirect('/denied');
  const parsed = closureSchema.safeParse(Object.fromEntries(formData));
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed.success || parsed.data.closureDate < today) {
    redirect('/onboarding/setup?error=Choose+a+current+or+future+closure+date+and+add+a+reason.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_location_closure', {
    target_business_id: context.businessId,
    target_closure_date: parsed.data.closureDate,
    target_customer_message: parsed.data.customerMessage,
    target_location_id: parsed.data.locationId,
    target_reason: parsed.data.reason,
  });
  if (error) redirect('/onboarding/setup?error=The+closure+could+not+be+saved.');
  redirect('/onboarding/setup?notice=Upcoming+closure+saved.');
}

const deleteClosureSchema = z.object({ closureId: z.uuid() });

export async function deleteLocationClosure(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('business.manage_locations')) redirect('/denied');
  const parsed = deleteClosureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/onboarding/setup?error=The+closure+could+not+be+removed.');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('delete_location_closure', {
    target_business_id: context.businessId,
    target_closure_id: parsed.data.closureId,
  });
  if (error) redirect('/onboarding/setup?error=The+closure+could+not+be+removed.');
  redirect('/onboarding/setup?notice=Closure+removed.');
}
