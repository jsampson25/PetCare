import { describe, expect, it } from 'vitest';

import { getSafeRedirect } from './safe-redirect';

describe('getSafeRedirect', () => {
  it('keeps an internal application path', () => {
    expect(getSafeRedirect('/app/calendar?view=week')).toBe('/app/calendar?view=week');
  });

  it.each(['https://evil.example', '//evil.example', 'javascript:alert(1)', 'app'])(
    'rejects unsafe redirect %s',
    (value) => expect(getSafeRedirect(value)).toBe('/app'),
  );

  it('supports a caller-selected fallback', () => {
    expect(getSafeRedirect(null, '/portal')).toBe('/portal');
  });
});
