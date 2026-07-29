import { describe, expect, it } from 'vitest';

import {
  formatAvailabilityReason,
  getAvailabilityDecision,
  summarizeAvailabilityResult,
} from './availability-result-view';

describe('availability result view', () => {
  it('prioritizes a blocked outcome over review requirements', () => {
    expect(
      getAvailabilityDecision({
        available: false,
        reasons: [],
        remaining_capacity: 0,
        requires_review: true,
      }),
    ).toBe('blocked');
    expect(
      getAvailabilityDecision({
        available: true,
        reasons: [],
        remaining_capacity: 2,
        requires_review: true,
      }),
    ).toBe('review');
  });

  it('separates blocking and staff-review reasons', () => {
    expect(
      summarizeAvailabilityResult({
        available: false,
        remaining_capacity: 4,
        requires_review: true,
        reasons: [
          { code: 'capacity_unavailable', message: 'No space remains.' },
          { key: 'document_review', level: 'review', message: 'Review the document.' },
        ],
      }),
    ).toEqual({
      decision: 'blocked',
      remainingCapacity: 4,
      blockingReasons: 1,
      reviewReasons: 1,
    });
  });

  it('formats stable reason identifiers for staff', () => {
    expect(formatAvailabilityReason({ code: 'service_not_active', message: 'Unavailable.' })).toBe(
      'service not active',
    );
    expect(formatAvailabilityReason({ message: 'Review.' })).toBe('review');
  });
});
