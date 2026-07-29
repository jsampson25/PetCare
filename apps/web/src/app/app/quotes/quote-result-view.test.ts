import { describe, expect, it } from 'vitest';

import { getQuoteValidity, summarizeQuoteResult } from './quote-result-view';

const now = new Date('2026-07-28T12:00:00.000Z');

describe('quote result view', () => {
  it('classifies active, expiring, and expired quotes', () => {
    expect(getQuoteValidity('2026-07-30T12:00:01.000Z', now)).toBe('active');
    expect(getQuoteValidity('2026-07-29T11:59:59.000Z', now)).toBe('expiring');
    expect(getQuoteValidity('2026-07-28T12:00:00.000Z', now)).toBe('expired');
  });

  it('summarizes payment timing and commercial adjustments', () => {
    expect(
      summarizeQuoteResult(
        {
          balance_due_minor: 9000,
          deposit_due_minor: 3000,
          discount_minor: 1000,
          expires_at: '2026-07-30T12:00:01.000Z',
          fee_minor: 500,
          subtotal_minor: 11000,
          tax_minor: 1500,
          total_minor: 12000,
        },
        now,
      ),
    ).toEqual({
      validity: 'active',
      dueNow: 3000,
      dueLater: 9000,
      savings: 1000,
      additions: 2000,
      reconciled: true,
    });
  });

  it('flags a quote whose displayed total does not reconcile', () => {
    expect(
      summarizeQuoteResult(
        {
          balance_due_minor: 0,
          deposit_due_minor: 0,
          discount_minor: 0,
          expires_at: '2026-07-30T12:00:01.000Z',
          fee_minor: 0,
          subtotal_minor: 1000,
          tax_minor: 0,
          total_minor: 999,
        },
        now,
      ).reconciled,
    ).toBe(false);
  });
});
