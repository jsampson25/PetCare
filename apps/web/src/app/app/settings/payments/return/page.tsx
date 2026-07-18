import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../../lib/auth/tenant-context';
import { retrieveConnectedAccount } from '../../../../../lib/payments/stripe-api';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/admin';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
export default async function StripeOnboardingReturn() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.manage')) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { data: merchant } = await supabase
    .from('merchant_accounts')
    .select('provider_account_id')
    .eq('business_id', context.businessId)
    .maybeSingle();
  if (!merchant) redirect('/app/settings/payments?error=Merchant+connection+was+not+found.');
  try {
    const account = await retrieveConnectedAccount(merchant.provider_account_id);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc('sync_stripe_merchant_account', {
      account_reference: account.id,
      capabilities_value: account.capabilities ?? {},
      charges_value: account.charges_enabled,
      details_value: account.details_submitted,
      disabled_reason_value: account.requirements?.disabled_reason ?? '',
      payouts_value: account.payouts_enabled,
      requirements_value: account.requirements?.currently_due ?? [],
      target_business_id: context.businessId,
    });
    if (error) throw error;
    redirect(
      `/app/settings/payments?notice=${account.charges_enabled && account.payouts_enabled ? 'Stripe+payments+are+active.' : 'Stripe+still+requires+information.'}`,
    );
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    redirect('/app/settings/payments?error=Stripe+status+could+not+be+verified.');
  }
}
