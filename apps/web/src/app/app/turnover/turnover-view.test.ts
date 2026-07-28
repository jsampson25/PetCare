import { describe, expect, it } from 'vitest';

import { filterTurnoverTasks, summarizeTurnoverTasks } from './turnover-view';

const tasks = [
  { id: 'waiting', status: 'cleaning_required', failure_reason: null },
  { id: 'reclean', status: 'cleaning_required', failure_reason: 'Odor remained' },
  { id: 'cleaning', status: 'cleaning', failure_reason: null },
  { id: 'inspection', status: 'inspection_required', failure_reason: null },
];

describe('turnover view', () => {
  it('filters the queue by workflow stage', () => {
    expect(filterTurnoverTasks(tasks, 'cleaning').map((task) => task.id)).toEqual(['cleaning']);
    expect(filterTurnoverTasks(tasks, 'all')).toEqual(tasks);
  });

  it('summarizes readiness work and failed inspections', () => {
    expect(summarizeTurnoverTasks(tasks)).toEqual({
      waiting: 2,
      cleaning: 1,
      inspection: 1,
      failed: 1,
    });
  });
});
