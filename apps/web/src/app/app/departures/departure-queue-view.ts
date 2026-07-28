export type DepartureQueueView = {
  balance_due_minor: number;
  blockers: string[];
};

export function filterDepartureQueue<Row extends DepartureQueueView>(rows: Row[], view: string) {
  return rows.filter((row) => {
    if (view === 'ready') return row.blockers.length === 0;
    if (view === 'blocked') return row.blockers.length > 0;
    if (view === 'open_care') return row.blockers.includes('open_care');
    if (view === 'open_incident') return row.blockers.includes('open_incident');
    if (view === 'balance_due') return row.balance_due_minor > 0;
    return true;
  });
}

export function summarizeDepartureQueue(rows: DepartureQueueView[]) {
  return {
    ready: rows.filter((row) => row.blockers.length === 0).length,
    blocked: rows.filter((row) => row.blockers.length > 0).length,
    openCare: rows.filter((row) => row.blockers.includes('open_care')).length,
    balanceDue: rows.filter((row) => row.balance_due_minor > 0).length,
  };
}
