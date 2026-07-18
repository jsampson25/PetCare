import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderTransactionalEmail, sendTransactionalEmail } from './transactional-email';

describe('transactional email', () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.TRANSACTIONAL_EMAIL_FROM;
  });

  it('escapes customer-controlled content and uses an application-origin link', () => {
    const result = renderTransactionalEmail(
      {
        business_name: '<Good Dogs>',
        message_type: 'payment_receipt',
        recipient_name: '<Pat>',
        template_data: { amount_minor: 2500, currency_code: 'USD', invoice_number: '<INV-1>' },
      },
      'https://petcare.test/untrusted/path',
    );
    expect(result.html).toContain('&lt;Pat&gt;');
    expect(result.html).toContain('https://petcare.test/portal');
    expect(result.html).not.toContain('<Pat>');
    expect(result.text).toContain('$25.00');
  });

  it('sends through Resend with server-only credentials', async () => {
    process.env.RESEND_API_KEY = 're_secret';
    process.env.TRANSACTIONAL_EMAIL_FROM = 'PetCare <test@petcare.test>';
    const fetcher = vi.fn(async () => Response.json({ id: 'email_123' }));
    await expect(
      sendTransactionalEmail(
        {
          to: 'pat@example.test',
          subject: 'Receipt',
          text: 'Paid',
          html: '<p>Paid</p>',
          idempotencyKey: 'outbox-123',
        },
        fetcher as typeof fetch,
      ),
    ).resolves.toBe('email_123');
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer re_secret',
          'Idempotency-Key': 'outbox-123',
          'User-Agent': 'PetCare/1.0',
        }),
      }),
    );
  });
});
