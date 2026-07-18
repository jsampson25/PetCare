import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { verifyStripeSignature } from './stripe-signature';

const body = '{"id":"evt_123","object":"event"}';
const secret = 'whsec_test_secret';
const timestamp = 1_700_000_000;
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
describe('Stripe webhook signature verification', () => {
  it('accepts an authentic unmodified body inside the tolerance', () =>
    expect(
      verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp + 60),
    ).toBe(timestamp));
  it('rejects a changed body', () =>
    expect(
      verifyStripeSignature(`${body} `, `t=${timestamp},v1=${signature}`, secret, timestamp),
    ).toBeNull());
  it('rejects stale delivery attempts', () =>
    expect(
      verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp + 301),
    ).toBeNull());
  it('supports key rotation signatures in one header', () =>
    expect(
      verifyStripeSignature(
        body,
        `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`,
        secret,
        timestamp,
      ),
    ).toBe(timestamp));
});
