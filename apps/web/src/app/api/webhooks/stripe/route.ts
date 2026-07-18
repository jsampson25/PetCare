import { createHash } from 'node:crypto';
import { z } from 'zod';

import { verifyStripeSignature } from '../../../../lib/payments/stripe-signature';
import { createSupabaseAdminClient } from '../../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';
const eventSchema = z
  .object({
    id: z.string().min(5),
    type: z.string().min(3),
    account: z.string().optional(),
    api_version: z.string().nullable().optional(),
    livemode: z.boolean(),
    data: z.object({ object: z.object({ id: z.string().optional() }).passthrough() }),
  })
  .passthrough();

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'Signature required.' }, { status: 400 });
  const rawBody = await request.text();
  const signatureTimestamp = verifyStripeSignature(rawBody, signature, secret);
  if (signatureTimestamp === null)
    return Response.json({ error: 'Invalid signature.' }, { status: 400 });
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid event.' }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: 'Invalid event.' }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: eventId, error } = await supabase.rpc('ingest_stripe_webhook', {
    account_reference: parsed.data.account ?? '',
    event_identifier: parsed.data.id,
    event_name: parsed.data.type,
    is_live: parsed.data.livemode,
    object_identifier: parsed.data.data.object.id ?? '',
    payload_hash: createHash('sha256').update(rawBody, 'utf8').digest('hex'),
    payload_value: parsed.data,
    signature_time: signatureTimestamp,
    version_value: parsed.data.api_version ?? '',
  });
  if (error) return Response.json({ error: 'Event persistence failed.' }, { status: 500 });
  if (parsed.data.type === 'checkout.session.completed' && typeof eventId === 'string') {
    // The inbox is durable first; posting failure remains retryable and does not reject delivery.
    await supabase.rpc('process_stripe_checkout_event', { target_event_id: eventId });
  }
  return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
}
