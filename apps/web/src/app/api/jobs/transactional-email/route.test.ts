import { afterEach, describe, expect, it } from 'vitest';

import { POST } from './route';

describe('transactional email worker', () => {
  afterEach(() => delete process.env.CRON_SECRET);

  it('rejects requests when the worker secret is absent or incorrect', async () => {
    process.env.CRON_SECRET = 'worker-secret';
    const response = await POST(
      new Request('https://petcare.test/api/jobs/transactional-email', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized.' });
  });
});
