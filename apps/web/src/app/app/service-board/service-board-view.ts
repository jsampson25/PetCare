export type ServiceExecutionView = {
  service_category: string;
  stage: string;
};

export function filterServiceExecutions<Execution extends ServiceExecutionView>(
  executions: Execution[],
  category: string,
  stageView: string,
) {
  return executions.filter((execution) => {
    if (category !== 'all' && execution.service_category !== category) return false;
    if (stageView === 'hold') return execution.stage === 'hold';
    if (stageView === 'ready') return execution.stage === 'ready';
    if (stageView === 'in_progress') return !['hold', 'ready'].includes(execution.stage);
    return true;
  });
}

export function summarizeServiceBoard(executions: ServiceExecutionView[], unstartedCount: number) {
  return {
    active: executions.length,
    onHold: executions.filter((execution) => execution.stage === 'hold').length,
    ready: executions.filter((execution) => execution.stage === 'ready').length,
    unstarted: unstartedCount,
  };
}
