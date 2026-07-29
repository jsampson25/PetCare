export type QuoteResultView = {
  balance_due_minor: number;
  deposit_due_minor: number;
  discount_minor: number;
  expires_at: string;
  fee_minor: number;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
};

export type QuoteValidity = 'active' | 'expiring' | 'expired';

export function getQuoteValidity(expiresAt: string, now = new Date()): QuoteValidity {
  const expires = new Date(expiresAt).getTime();
  if (expires <= now.getTime()) return 'expired';
  if (expires - now.getTime() <= 24 * 60 * 60 * 1000) return 'expiring';
  return 'active';
}

export function summarizeQuoteResult(quote: QuoteResultView, now = new Date()) {
  const calculatedTotal =
    quote.subtotal_minor + quote.fee_minor + quote.tax_minor - quote.discount_minor;
  return {
    validity: getQuoteValidity(quote.expires_at, now),
    dueNow: quote.deposit_due_minor,
    dueLater: quote.balance_due_minor,
    savings: quote.discount_minor,
    additions: quote.fee_minor + quote.tax_minor,
    reconciled: calculatedTotal === quote.total_minor,
  };
}
