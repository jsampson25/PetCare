import { describe, expect, it } from 'vitest';

import { filterServiceExecutions, summarizeServiceBoard } from './service-board-view';

const executions = [
  { id: '1', service_category: 'boarding', stage: 'active' },
  { id: '2', service_category: 'boarding', stage: 'hold' },
  { id: '3', service_category: 'daycare', stage: 'ready' },
  { id: '4', service_category: 'grooming', stage: 'bathing' },
];

describe('service board view', () => {
  it('filters by service category and operational stage', () => {
    expect(filterServiceExecutions(executions, 'boarding', 'all').map((item) => item.id)).toEqual([
      '1',
      '2',
    ]);
    expect(filterServiceExecutions(executions, 'all', 'hold').map((item) => item.id)).toEqual([
      '2',
    ]);
    expect(
      filterServiceExecutions(executions, 'all', 'in_progress').map((item) => item.id),
    ).toEqual(['1', '4']);
  });

  it('summarizes active, held, ready, and unstarted work', () => {
    expect(summarizeServiceBoard(executions, 2)).toEqual({
      active: 4,
      onHold: 1,
      ready: 1,
      unstarted: 2,
    });
  });
});
