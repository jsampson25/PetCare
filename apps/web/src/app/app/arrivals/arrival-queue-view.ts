export type ArrivalQueueState = 'expected' | 'handoff' | 'in_care';

export type ArrivalQueueView = {
  pending_handoff: boolean;
  visit_status: string;
};

export function getArrivalQueueState(row: ArrivalQueueView): ArrivalQueueState {
  if (row.visit_status === 'in_care') return 'in_care';
  if (row.pending_handoff) return 'handoff';
  return 'expected';
}

export function filterArrivalQueue<Row extends ArrivalQueueView>(rows: Row[], view: string) {
  if (view === 'all') return rows;
  return rows.filter((row) => getArrivalQueueState(row) === view);
}

export function summarizeArrivalQueue(rows: ArrivalQueueView[]) {
  return {
    scheduled: rows.length,
    expected: rows.filter((row) => getArrivalQueueState(row) === 'expected').length,
    handoff: rows.filter((row) => getArrivalQueueState(row) === 'handoff').length,
    inCare: rows.filter((row) => getArrivalQueueState(row) === 'in_care').length,
  };
}
