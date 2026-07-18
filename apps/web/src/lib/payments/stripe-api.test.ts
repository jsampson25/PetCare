import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOnboardingLink, stripeRequest, StripeApiError } from './stripe-api';
describe('Stripe API boundary', () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });
  it('sends secrets only in authorization and encodes form data', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ url: 'https://connect.stripe.test/link', expires_at: 123 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await stripeRequest('/account_links', {
      method: 'POST',
      body: new URLSearchParams({ account: 'acct_123' }),
      fetcher: fetcher as typeof fetch,
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/account_links',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk_test_secret' }),
        body: 'account=acct_123',
      }),
    );
  });
  it('creates authenticated return and refresh URLs', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
    const original = global.fetch;
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ url: 'https://connect.stripe.test/link', expires_at: 123 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await createOnboardingLink('acct_123', 'https://petcare.test');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining(
          'return_url=https%3A%2F%2Fpetcare.test%2Fapp%2Fsettings%2Fpayments%2Freturn',
        ),
      }),
    );
    global.fetch = original;
  });
  it('returns a safe categorized error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { type: 'invalid_request_error' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await expect(stripeRequest('/accounts', { fetcher: fetcher as typeof fetch })).rejects.toEqual(
      expect.objectContaining<Partial<StripeApiError>>({
        status: 400,
        type: 'invalid_request_error',
      }),
    );
  });
});
