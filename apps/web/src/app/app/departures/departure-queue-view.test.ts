import { describe, expect, it } from 'vitest';

import { filterDepartureQueue, summarizeDepartureQueue } from './departure-queue-view';

const rows = [
  { id: 'ready', blockers: [], balance_due_minor: 0 },
  { id: 'care', blockers: ['open_care'], balance_due_minor: 0 },
  { id: 'incident-balance', blockers: ['open_incident', 'balance_due'], balance_due_minor: 4500 },
];

describe('departure queue view', () => {
  it('filters ready pets and specific blocker queues', () => {
    expect(filterDepartureQueue(rows, 'ready').map((row) => row.id)).toEqual(['ready']);
    expect(filterDepartureQueue(rows, 'open_incident').map((row) => row.id)).toEqual([
      'incident-balance',
    ]);
    expect(filterDepartureQueue(rows, 'balance_due').map((row) => row.id)).toEqual([
      'incident-balance',
    ]);
  });

  it('summarizes checkout readiness without double-counting rows', () => {
    expect(summarizeDepartureQueue(rows)).toEqual({
      ready: 1,
      blocked: 2,
      openCare: 1,
      balanceDue: 1,
    });
  });
});
