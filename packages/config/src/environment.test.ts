import { describe, expect, it } from 'vitest';

import { parsePublicEnvironment } from './environment';

describe('public environment', () => {
  it('accepts a complete public configuration', () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      }),
    ).toMatchObject({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' });
  });

  it('rejects a secret-free but incomplete configuration', () => {
    expect(() => parsePublicEnvironment({ NEXT_PUBLIC_APP_URL: 'not-a-url' })).toThrow();
  });
});
