export type CareTaskView = {
  due_starts_at: string;
  due_ends_at: string;
  task_type: string;
};

export type CareTiming = 'all' | 'overdue' | 'due' | 'upcoming';

export function getCareTaskTiming(task: CareTaskView, now: Date): Exclude<CareTiming, 'all'> {
  if (new Date(task.due_ends_at) < now) return 'overdue';
  if (new Date(task.due_starts_at) <= now) return 'due';
  return 'upcoming';
}

export function filterCareTasks<Task extends CareTaskView>(
  tasks: Task[],
  taskType: string,
  timing: CareTiming,
  now: Date,
) {
  return tasks.filter((task) => {
    if (taskType !== 'all' && task.task_type !== taskType) return false;
    return timing === 'all' || getCareTaskTiming(task, now) === timing;
  });
}

export function summarizeCareTasks(tasks: CareTaskView[], now: Date) {
  return tasks.reduce(
    (summary, task) => {
      summary.open += 1;
      summary[getCareTaskTiming(task, now)] += 1;
      return summary;
    },
    { open: 0, overdue: 0, due: 0, upcoming: 0 },
  );
}
