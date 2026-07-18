type Message = {
  business_name: string;
  message_type: string;
  recipient_name: string;
  template_data: Record<string, unknown>;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const money = (minor: unknown, currency: unknown) => {
  const amount = typeof minor === 'number' ? minor : Number(minor);
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount / 100);
};

export function renderTransactionalEmail(message: Message, appUrl: string) {
  const invoice = String(message.template_data.invoice_number ?? '');
  const amount = money(
    message.template_data.amount_minor ?? message.template_data.total_minor,
    message.template_data.currency_code,
  );
  const safeBase = new URL(appUrl).origin;
  const content: Record<string, { subject: string; heading: string; body: string }> = {
    invoice_issued: {
      subject: `Invoice ${invoice} is ready`,
      heading: 'Your invoice is ready',
      body: `Invoice ${invoice} totals ${amount}.`,
    },
    payment_receipt: {
      subject: `Payment received for ${invoice}`,
      heading: 'Payment received',
      body: `We received ${amount} for invoice ${invoice}.`,
    },
    refund_issued: {
      subject: `Refund issued for ${invoice}`,
      heading: 'Your refund was issued',
      body: `${amount} was returned for invoice ${invoice}.`,
    },
    payment_failed: {
      subject: `Payment needs attention for ${invoice}`,
      heading: 'Payment needs attention',
      body: `We could not complete the payment for invoice ${invoice}.`,
    },
    booking_confirmed: {
      subject: 'Your booking is confirmed',
      heading: 'Booking confirmed',
      body: 'Your pet-care booking is confirmed.',
    },
  };
  const copy = content[message.message_type] ?? {
    subject: 'Update from PetCare',
    heading: 'Account update',
    body: 'There is an update on your PetCare account.',
  };
  const text = `${copy.heading}\n\nHi ${message.recipient_name || 'there'},\n\n${copy.body}\n\nView your account: ${safeBase}/portal\n\n${message.business_name}`;
  const html = `<main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h1>${escapeHtml(copy.heading)}</h1><p>Hi ${escapeHtml(message.recipient_name || 'there')},</p><p>${escapeHtml(copy.body)}</p><p><a href="${safeBase}/portal">View your account</a></p><p>${escapeHtml(message.business_name)}</p></main>`;
  return { subject: copy.subject, text, html };
}

export async function sendTransactionalEmail(
  input: { to: string; subject: string; text: string; html: string; idempotencyKey: string },
  fetcher: typeof fetch = fetch,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TRANSACTIONAL_EMAIL_FROM;
  if (!apiKey || !from) throw new Error('email_configuration_missing');
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
      'User-Agent': 'PetCare/1.0',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
    cache: 'no-store',
  });
  const payload = (await response.json()) as { id?: string };
  if (!response.ok || !payload.id) throw new Error(`email_provider_${response.status}`);
  return payload.id;
}
