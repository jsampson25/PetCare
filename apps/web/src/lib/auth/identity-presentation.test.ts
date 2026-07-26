import { describe, expect, it } from 'vitest';

import { resolveIdentityPresentation } from './identity-presentation';

describe('resolveIdentityPresentation', () => {
  it('prefers the profile display name and keeps the account email', () => {
    expect(
      resolveIdentityPresentation({
        email: 'owner@example.com',
        user_metadata: { display_name: 'Jordan Owner', full_name: 'Ignored Name' },
      }),
    ).toEqual({ email: 'owner@example.com', name: 'Jordan Owner' });
  });

  it('falls back to the email username when profile metadata is missing', () => {
    expect(resolveIdentityPresentation({ email: 'care.team@example.com' })).toEqual({
      email: 'care.team@example.com',
      name: 'care.team',
    });
  });

  it('uses a neutral label for malformed claims', () => {
    expect(resolveIdentityPresentation(null)).toEqual({ name: 'Signed-in user' });
  });
});
