import { describe, expect, it } from 'vitest';

import { validateTenantActionColor } from './tenant-theme';

describe('tenant action color validation', () => {
  it('chooses accessible light text for a dark tenant color', () => {
    expect(validateTenantActionColor('#176b4d')).toMatchObject({
      accepted: true,
      actionColor: '#176b4d',
      actionTextColor: '#ffffff',
    });
  });

  it('chooses accessible dark text for a light tenant color', () => {
    expect(validateTenantActionColor('#f4d35e')).toMatchObject({
      accepted: true,
      actionTextColor: '#000000',
    });
  });

  it('rejects malformed theme values', () => {
    expect(validateTenantActionColor('green')).toEqual({
      accepted: false,
      reason: 'Use a six-digit hexadecimal color such as #176b4d.',
    });
  });
});
