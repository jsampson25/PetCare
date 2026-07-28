export type GroomingWorkState =
  'intake_required' | 'authorization_required' | 'in_progress' | 'quality_review' | 'hold';

export type GroomingQueueView = {
  work_state: GroomingWorkState;
};

export function filterGroomingQueue<Row extends GroomingQueueView>(rows: Row[], workState: string) {
  return workState === 'all' ? rows : rows.filter((row) => row.work_state === workState);
}

export function summarizeGroomingQueue(rows: GroomingQueueView[]) {
  return {
    active: rows.length,
    intake: rows.filter((row) => row.work_state === 'intake_required').length,
    authorization: rows.filter((row) => row.work_state === 'authorization_required').length,
    quality: rows.filter((row) => row.work_state === 'quality_review').length,
    hold: rows.filter((row) => row.work_state === 'hold').length,
  };
}
