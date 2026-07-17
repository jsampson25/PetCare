import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /api/health', () => {
  it('returns an uncached healthy response', async () => {
    const response = GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(payload).toMatchObject({ service: 'petcare-web', status: 'ok' });
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
  });
});
