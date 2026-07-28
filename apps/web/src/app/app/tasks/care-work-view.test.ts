import { describe, expect, it } from 'vitest';

import { filterCareTasks, getCareTaskTiming, summarizeCareTasks } from './care-work-view';

const now = new Date('2026-07-28T15:00:00.000Z');
const tasks = [
  {
    id: 'overdue-feeding',
    task_type: 'feeding',
    due_starts_at: '2026-07-28T12:00:00.000Z',
    due_ends_at: '2026-07-28T13:00:00.000Z',
  },
  {
    id: 'due-medication',
    task_type: 'medication',
    due_starts_at: '2026-07-28T14:30:00.000Z',
    due_ends_at: '2026-07-28T15:30:00.000Z',
  },
  {
    id: 'upcoming-feeding',
    task_type: 'feeding',
    due_starts_at: '2026-07-28T17:00:00.000Z',
    due_ends_at: '2026-07-28T18:00:00.000Z',
  },
];

describe('care work view', () => {
  it('classifies tasks against their explicit due window', () => {
    expect(tasks.map((task) => getCareTaskTiming(task, now))).toEqual([
      'overdue',
      'due',
      'upcoming',
    ]);
  });

  it('combines task type and timing filters', () => {
    expect(filterCareTasks(tasks, 'feeding', 'upcoming', now).map((task) => task.id)).toEqual([
      'upcoming-feeding',
    ]);
    expect(filterCareTasks(tasks, 'medication', 'all', now).map((task) => task.id)).toEqual([
      'due-medication',
    ]);
  });

  it('summarizes mutually exclusive workload states', () => {
    expect(summarizeCareTasks(tasks, now)).toEqual({
      open: 3,
      overdue: 1,
      due: 1,
      upcoming: 1,
    });
  });
});
