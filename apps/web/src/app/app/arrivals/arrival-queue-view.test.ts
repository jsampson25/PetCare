import { describe, expect, it } from 'vitest';

import {
  filterArrivalQueue,
  getArrivalQueueState,
  summarizeArrivalQueue,
} from './arrival-queue-view';

const rows = [
  { id: 'expected', pending_handoff: false, visit_status: 'expected' },
  { id: 'arrived', pending_handoff: false, visit_status: 'arrived' },
  { id: 'handoff', pending_handoff: true, visit_status: 'arrived' },
  { id: 'care', pending_handoff: true, visit_status: 'in_care' },
];

describe('arrival queue view', () => {
  it('classifies in-care pets ahead of stale handoff state', () => {
    expect(getArrivalQueueState(rows[2])).toBe('handoff');
    expect(getArrivalQueueState(rows[3])).toBe('in_care');
  });

  it('filters the queue by operational arrival state', () => {
    expect(filterArrivalQueue(rows, 'expected').map((row) => row.id)).toEqual([
      'expected',
      'arrived',
    ]);
    expect(filterArrivalQueue(rows, 'handoff').map((row) => row.id)).toEqual(['handoff']);
    expect(filterArrivalQueue(rows, 'in_care').map((row) => row.id)).toEqual(['care']);
  });

  it('summarizes scheduled arrivals without double-counting pets', () => {
    expect(summarizeArrivalQueue(rows)).toEqual({
      scheduled: 4,
      expected: 2,
      handoff: 1,
      inCare: 1,
    });
  });
});
