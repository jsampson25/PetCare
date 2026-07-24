'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { dollarsToMinor, percentToBasisPoints } from '../../../../lib/pricing/pricing-values';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const decimalAmount = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/);

const starterBundleSchema = z.object({
  cancellationFee: decimalAmount,
  cancellationHours: z.coerce.number().int().min(0).max(720),
  depositPercent: z.coerce.number().min(0).max(100),
  locationId: z.uuid(),
  noShowFee: decimalAmount,
  taxPercent: z.coerce.number().min(0).max(25),
});

export async function createStarterPricingBundle(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = starterBundleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect('/app/settings/pricing?onboarding=1&error=Check+the+pricing+policy+details.');
  }

  const supabase = await createSupabaseServerClient();
  const depositPercent = parsed.data.depositPercent;
  const { error } = await supabase.rpc('create_pricing_bundle', {
    agreement_name: 'Service Agreement',
    agreement_text:
      'By completing a booking, the customer confirms that the information provided is accurate and agrees to the business cancellation, safety, and payment policies shown during checkout.',
    book_name: 'Standard Pricing',
    cancellation_fee: dollarsToMinor(parsed.data.cancellationFee),
    cancellation_hours: parsed.data.cancellationHours,
    currency: 'USD',
    deposit_amount: percentToBasisPoints(depositPercent),
    deposit_kind: depositPercent > 0 ? 'percentage' : 'none',
    no_show_fee: dollarsToMinor(parsed.data.noShowFee),
    policy_name: 'Standard Booking Policy',
    summary_text: `${parsed.data.cancellationHours} hours notice is required for cancellation. ${
      depositPercent > 0
        ? `A ${depositPercent}% deposit is due when booking.`
        : 'No deposit is required.'
    }`,
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    tax_bps: percentToBasisPoints(parsed.data.taxPercent),
  });
  if (error) {
    redirect('/app/settings/pricing?onboarding=1&error=The+pricing+setup+could+not+be+created.');
  }
  redirect(
    '/app/settings/pricing?onboarding=1&notice=Pricing+policy+saved.+Add+your+service+prices.',
  );
}

const starterRatesSchema = z.object({
  locationId: z.uuid(),
  priceVersionId: z.uuid(),
});

export async function saveStarterRates(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = starterRatesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect('/app/settings/pricing?onboarding=1&error=Pricing+setup+is+not+ready.');
  }

  const submittedRates = [...formData.entries()]
    .filter(([name]) => name.startsWith('rate:'))
    .map(([name, value]) => {
      const [, serviceVersionId, unit] = name.split(':');
      const amount = String(value).trim();
      return { amount, serviceVersionId, unit };
    })
    .filter((rate) => rate.amount !== '');
  const rateEntrySchema = z.object({
    amount: decimalAmount,
    serviceVersionId: z.uuid(),
    unit: z.enum(['night', 'day', 'appointment']),
  });
  const validatedRates = z.array(rateEntrySchema).min(1).safeParse(submittedRates);
  if (!validatedRates.success) {
    redirect('/app/settings/pricing?onboarding=1&error=Enter+at+least+one+valid+service+price.');
  }

  const supabase = await createSupabaseServerClient();
  const versionIds = validatedRates.data.map((rate) => rate.serviceVersionId);
  const { data: allowedVersions, error: versionsError } = await supabase
    .from('service_versions')
    .select('id,customer_name')
    .eq('business_id', context.businessId)
    .in('id', versionIds)
    .in('status', ['draft', 'published']);
  if (versionsError || allowedVersions?.length !== new Set(versionIds).size) {
    redirect('/app/settings/pricing?onboarding=1&error=One+or+more+services+are+not+available.');
  }
  const names = new Map(
    (allowedVersions ?? []).map((version) => [version.id, version.customer_name]),
  );

  for (const rate of validatedRates.data) {
    const { error } = await supabase.rpc('add_price_rate', {
      amount_value: dollarsToMinor(rate.amount),
      end_date: null,
      label_value: names.get(rate.serviceVersionId) ?? 'Service rate',
      priority_value: 100,
      start_date: null,
      target_business_id: context.businessId,
      target_location_id: parsed.data.locationId,
      target_price_version_id: parsed.data.priceVersionId,
      target_service_version_id: rate.serviceVersionId,
      unit_value: rate.unit,
    });
    if (error) {
      redirect('/app/settings/pricing?onboarding=1&error=One+or+more+prices+could+not+be+saved.');
    }
  }
  redirect('/app/settings/pricing?onboarding=1&notice=Service+prices+saved.');
}

const bundleSchema = z.object({
  agreementBody: z.string().trim().min(10).max(10000),
  agreementTitle: z.string().trim().min(2).max(160),
  bookName: z.string().trim().min(1).max(120),
  cancellationFee: z.coerce.number().int().nonnegative(),
  cancellationHours: z.coerce.number().int().nonnegative(),
  currency: z.string().trim().length(3),
  depositType: z.enum(['none', 'fixed', 'percentage', 'full']),
  depositValue: z.coerce.number().int().nonnegative(),
  locationId: z.uuid(),
  noShowFee: z.coerce.number().int().nonnegative(),
  policyName: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(2).max(1000),
  taxBps: z.coerce.number().int().min(0).max(10000),
});
export async function createPricingBundle(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = bundleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect('/app/settings/pricing?error=Check+the+pricing+and+policy+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_pricing_bundle', {
    agreement_name: parsed.data.agreementTitle,
    agreement_text: parsed.data.agreementBody,
    book_name: parsed.data.bookName,
    cancellation_fee: parsed.data.cancellationFee,
    cancellation_hours: parsed.data.cancellationHours,
    currency: parsed.data.currency.toUpperCase(),
    deposit_amount: parsed.data.depositValue,
    deposit_kind: parsed.data.depositType,
    no_show_fee: parsed.data.noShowFee,
    policy_name: parsed.data.policyName,
    summary_text: parsed.data.summary,
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    tax_bps: parsed.data.taxBps,
  });
  if (error) redirect('/app/settings/pricing?error=The+pricing+bundle+could+not+be+created.');
  redirect('/app/settings/pricing?notice=Draft+pricing+bundle+created.');
}

const rateSchema = z.object({
  amount: z.coerce.number().int().nonnegative(),
  label: z.string().trim().min(1).max(160),
  locationId: z.uuid(),
  priceVersionId: z.uuid(),
  priority: z.coerce.number().int().min(1).max(10000),
  serviceVersionId: z.uuid(),
  unit: z.enum(['night', 'day', 'appointment', 'pet', 'booking', 'occurrence', 'quantity']),
});
export async function addPriceRate(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/pricing?error=Check+the+rate+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_price_rate', {
    amount_value: parsed.data.amount,
    end_date: null,
    label_value: parsed.data.label,
    priority_value: parsed.data.priority,
    start_date: null,
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    target_price_version_id: parsed.data.priceVersionId,
    target_service_version_id: parsed.data.serviceVersionId,
    unit_value: parsed.data.unit,
  });
  if (error) redirect('/app/settings/pricing?error=The+rate+could+not+be+saved.');
  redirect('/app/settings/pricing?notice=Rate+saved.');
}

const publishSchema = z.object({
  effectiveDate: z.string().date(),
  policyVersionId: z.uuid(),
  priceVersionId: z.uuid(),
});
export async function publishPricingBundle(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = publishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/pricing?error=Check+the+publication+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('publish_pricing_bundle', {
    effective_date: parsed.data.effectiveDate,
    target_business_id: context.businessId,
    target_policy_version_id: parsed.data.policyVersionId,
    target_price_version_id: parsed.data.priceVersionId,
  });
  if (error) redirect('/app/settings/pricing?error=The+pricing+bundle+could+not+be+published.');
  redirect('/app/settings/pricing?notice=Pricing+and+policies+published.');
}

const revisionSchema = z.object({ policyVersionId: z.uuid(), priceVersionId: z.uuid() });
export async function createPricingRevision(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = revisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/pricing?error=Select+a+published+pricing+bundle.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_pricing_revision', {
    target_business_id: context.businessId,
    target_policy_version_id: parsed.data.policyVersionId,
    target_price_version_id: parsed.data.priceVersionId,
  });
  if (error) redirect('/app/settings/pricing?error=The+pricing+revision+could+not+be+created.');
  redirect('/app/settings/pricing?notice=Draft+revision+created+from+published+pricing.');
}

const adjustmentSchema = z.object({
  adjustmentType: z.enum(['fixed', 'percentage']),
  adjustmentValue: z.coerce.number().int().nonnegative(),
  label: z.string().trim().min(1).max(160),
  locationId: z.uuid(),
  priceVersionId: z.uuid(),
  priority: z.coerce.number().int().min(1).max(10000),
  ruleType: z.enum(['seasonal', 'holiday', 'weekend', 'peak']),
  serviceVersionId: z.uuid(),
});
export async function addPriceAdjustment(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/pricing?error=Check+the+adjustment+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_price_adjustment', {
    adjustment_amount: parsed.data.adjustmentValue,
    adjustment_kind: parsed.data.adjustmentType,
    dow: parsed.data.ruleType === 'weekend' ? 6 : null,
    end_date: null,
    label_value: parsed.data.label,
    priority_value: parsed.data.priority,
    rule_kind: parsed.data.ruleType,
    start_date: null,
    target_business_id: context.businessId,
    target_location_id: parsed.data.locationId,
    target_price_version_id: parsed.data.priceVersionId,
    target_service_version_id: parsed.data.serviceVersionId,
  });
  if (error) redirect('/app/settings/pricing?error=The+adjustment+could+not+be+saved.');
  redirect('/app/settings/pricing?notice=Pricing+adjustment+saved.');
}

const discountSchema = z.object({
  code: z.string().trim().min(3).max(32),
  discountType: z.enum(['fixed', 'percentage']),
  discountValue: z.coerce.number().int().nonnegative(),
  label: z.string().trim().min(1).max(160),
  priceVersionId: z.uuid(),
});
export async function addDiscountCode(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.manage')) redirect('/denied');
  const parsed = discountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/app/settings/pricing?error=Check+the+discount+details.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_discount_code', {
    code_value: parsed.data.code,
    discount_amount: parsed.data.discountValue,
    discount_kind: parsed.data.discountType,
    label_value: parsed.data.label,
    maximum_minor: null,
    minimum_minor: 0,
    target_business_id: context.businessId,
    target_price_version_id: parsed.data.priceVersionId,
    usage_limit_value: null,
  });
  if (error) redirect('/app/settings/pricing?error=The+discount+could+not+be+saved.');
  redirect('/app/settings/pricing?notice=Discount+code+saved.');
}
