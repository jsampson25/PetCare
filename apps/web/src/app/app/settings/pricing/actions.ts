'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

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
