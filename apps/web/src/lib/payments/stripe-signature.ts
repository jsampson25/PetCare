import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  endpointSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
) {
  const parts = signatureHeader.split(',').map((part) => part.trim().split('='));
  const timestampText = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || signatures.length === 0) return null;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return null;
  const expected = createHmac('sha256', endpointSecret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest();
  const valid = signatures.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const provided = Buffer.from(candidate, 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
  return valid ? timestamp : null;
}
