export type TurnoverTaskView = {
  failure_reason: string | null;
  status: string;
};

export function filterTurnoverTasks<Task extends TurnoverTaskView>(tasks: Task[], status: string) {
  return status === 'all' ? tasks : tasks.filter((task) => task.status === status);
}

export function summarizeTurnoverTasks(tasks: TurnoverTaskView[]) {
  return {
    waiting: tasks.filter((task) => task.status === 'cleaning_required').length,
    cleaning: tasks.filter((task) => task.status === 'cleaning').length,
    inspection: tasks.filter((task) => task.status === 'inspection_required').length,
    failed: tasks.filter((task) => Boolean(task.failure_reason)).length,
  };
}
