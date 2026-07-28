import { describe, expect, it } from 'vitest';

import { filterPlaygroupSessions, summarizePlaygroupBoard } from './playgroup-board-view';

const sessions = [
  {
    id: 'small-open',
    size_band: 'small',
    active_count: 3,
    effective_capacity: 5,
    resting_count: 1,
    removed_count: 0,
  },
  {
    id: 'large-full',
    size_band: 'large',
    active_count: 6,
    effective_capacity: 6,
    resting_count: 0,
    removed_count: 1,
  },
];

describe('playgroup board view', () => {
  it('combines care-band and session-attention filters', () => {
    expect(filterPlaygroupSessions(sessions, 'small', 'available').map((row) => row.id)).toEqual([
      'small-open',
    ]);
    expect(filterPlaygroupSessions(sessions, 'all', 'attention').map((row) => row.id)).toEqual([
      'large-full',
    ]);
  });

  it('summarizes session and participant workload', () => {
    expect(summarizePlaygroupBoard(sessions, 2)).toEqual({
      sessions: 2,
      active: 9,
      resting: 1,
      removed: 1,
      eligible: 2,
    });
  });
});
