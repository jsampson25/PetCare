import { describe, expect, it } from 'vitest';

import { getEmailActionRedirect } from './email-action';

describe('getEmailActionRedirect', () => {
  it.each([
    ['signup', '/auth/verified'],
    ['email', '/auth/verified'],
    ['email_change', '/auth/complete?action=email-change'],
    ['invite', '/auth/complete?action=invite'],
    ['magiclink', '/auth/select-business'],
    ['recovery', '/auth/update-password'],
  ])('maps %s to %s', (type, destination) => {
    expect(getEmailActionRedirect(type)).toBe(destination);
  });

  it.each([null, 'unknown'])('uses the application fallback for %s', (type) => {
    expect(getEmailActionRedirect(type)).toBe('/app');
  });
});
