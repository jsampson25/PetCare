'use server';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createConnectedAccount, createOnboardingLink } from '../../../../lib/payments/stripe-api';
import { createSupabaseAdminClient } from '../../../../lib/supabase/admin';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
export async function startStripeOnboarding() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.manage')) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from('merchant_accounts')
    .select('provider_account_id')
    .eq('business_id', context.businessId)
    .maybeSingle();
  let accountId = existing?.provider_account_id;
  try {
    if (!accountId) {
      const account = await createConnectedAccount(context.businessName, context.businessId);
      accountId = account.id;
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
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('Application URL unavailable');
    const link = await createOnboardingLink(accountId, appUrl);
    redirect(link.url);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    redirect('/app/settings/payments?error=Stripe+onboarding+could+not+be+started.');
  }
}

export async function requeueTransactionalEmail(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('payments.manage')) redirect('/denied');
  const messageId = formData.get('messageId');
  if (typeof messageId !== 'string') redirect('/app/settings/payments?error=Message+unavailable.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('requeue_transactional_email', {
    target_business_id: context.businessId,
    target_message_id: messageId,
  });
  if (error) redirect('/app/settings/payments?error=Message+could+not+be+requeued.');
  redirect('/app/settings/payments?notice=Message+queued+for+another+delivery+attempt.');
}
