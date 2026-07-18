import { createSupabaseAdminClient } from '../../../../lib/supabase/admin';
import {
  renderTransactionalEmail,
  sendTransactionalEmail,
} from '../../../../lib/communications/transactional-email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data: messages, error } = await supabase.rpc('claim_transactional_email', {
    batch_size: 2,
  });
  if (error) return Response.json({ error: 'Outbox unavailable.' }, { status: 503 });
  let sent = 0;
  let failed = 0;
  for (const message of messages ?? []) {
    try {
      const rendered = renderTransactionalEmail(
        message,
        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      );
      const providerId = await sendTransactionalEmail({
        to: message.recipient_email,
        idempotencyKey: `outbox-${message.message_id}`,
        ...rendered,
      });
      const { error: completionError } = await supabase.rpc('complete_transactional_email', {
        error_category: '',
        provider_identifier: providerId,
        provider_value: 'resend',
        target_message_id: message.message_id,
        was_sent: true,
      });
      if (completionError) throw new Error('delivery_completion_failed');
      sent += 1;
    } catch (error) {
      const category = error instanceof Error ? error.message.slice(0, 100) : 'delivery_error';
      await supabase.rpc('complete_transactional_email', {
        error_category: category,
        provider_identifier: '',
        provider_value: 'resend',
        target_message_id: message.message_id,
        was_sent: false,
      });
      failed += 1;
    }
  }
  return Response.json(
    { claimed: messages?.length ?? 0, failed, sent },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = POST;
