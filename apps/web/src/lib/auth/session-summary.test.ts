import { describe, expect, it } from 'vitest';

import { getSessionSummary } from './session-summary';

describe('getSessionSummary', () => {
  it('returns safe timestamps and AAL2 assurance', () => {
    const summary = getSessionSummary({ aal: 'aal2', exp: 1_800_000_000, iat: 1_700_000_000 });
    expect(summary.assurance).toBe('MFA verified');
    expect(summary.expiresAt?.toISOString()).toBe('2027-01-15T08:00:00.000Z');
    expect(summary.issuedAt?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('defaults malformed or absent claims safely', () => {
    expect(getSessionSummary({ aal: 'unexpected', exp: 'secret', iat: -1 })).toEqual({
      assurance: 'Password verified',
      expiresAt: undefined,
      issuedAt: undefined,
    });
  });
});
