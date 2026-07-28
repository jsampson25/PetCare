import { describe, expect, it } from 'vitest';

import { filterGroomingQueue, summarizeGroomingQueue } from './grooming-queue-view';

const rows = [
  { id: 'intake', work_state: 'intake_required' as const },
  { id: 'authorization', work_state: 'authorization_required' as const },
  { id: 'working', work_state: 'in_progress' as const },
  { id: 'quality', work_state: 'quality_review' as const },
  { id: 'hold', work_state: 'hold' as const },
];

describe('grooming queue view', () => {
  it('filters by the next operational action', () => {
    expect(filterGroomingQueue(rows, 'authorization_required').map((row) => row.id)).toEqual([
      'authorization',
    ]);
    expect(filterGroomingQueue(rows, 'all')).toEqual(rows);
  });

  it('summarizes intake, authorization, quality, and hold workload', () => {
    expect(summarizeGroomingQueue(rows)).toEqual({
      active: 5,
      intake: 1,
      authorization: 1,
      quality: 1,
      hold: 1,
    });
  });
});
