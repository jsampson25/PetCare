const apiBase = 'https://api.stripe.com/v1';
export class StripeApiError extends Error {
  constructor(
    public status: number,
    public type: string,
  ) {
    super('Stripe request failed.');
  }
}
export async function stripeRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: URLSearchParams;
    idempotencyKey?: string;
    fetcher?: typeof fetch;
  } = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe server configuration is required.');
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body?.toString(),
    cache: 'no-store',
  });
  const payload = (await response.json()) as { error?: { type?: string } };
  if (!response.ok)
    throw new StripeApiError(response.status, payload.error?.type ?? 'stripe_error');
  return payload as T;
}
export type StripeConnectedAccount = {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  capabilities: Record<string, string>;
  requirements?: { currently_due?: string[]; disabled_reason?: string | null };
};
export async function createConnectedAccount(businessName: string, businessId: string) {
  const body = new URLSearchParams({
    country: 'US',
    'business_profile[name]': businessName,
    'business_profile[product_description]':
      'Pet boarding, daycare, grooming, and related pet care services',
    'controller[fees][payer]': 'account',
    'controller[losses][payments]': 'stripe',
    'controller[stripe_dashboard][type]': 'express',
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
  });
  return stripeRequest<StripeConnectedAccount>('/accounts', {
    method: 'POST',
    body,
    idempotencyKey: `petcare-connect-${businessId}`,
  });
}
export async function createOnboardingLink(accountId: string, appUrl: string) {
  const body = new URLSearchParams({
    account: accountId,
    refresh_url: `${appUrl}/app/settings/payments/refresh`,
    return_url: `${appUrl}/app/settings/payments/return`,
    type: 'account_onboarding',
    'collection_options[fields]': 'eventually_due',
  });
  return stripeRequest<{ url: string; expires_at: number }>('/account_links', {
    method: 'POST',
    body,
  });
}
export async function retrieveConnectedAccount(accountId: string) {
  return stripeRequest<StripeConnectedAccount>(`/accounts/${encodeURIComponent(accountId)}`);
}
