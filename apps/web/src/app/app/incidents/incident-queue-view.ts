export type IncidentQueueView = {
  customer_notified: boolean;
  manager_review_required: boolean;
  severity: string;
  status: string;
};

export type IncidentStageView = 'all' | 'response' | 'review' | 'resolved';

export function getIncidentStage(status: string): Exclude<IncidentStageView, 'all'> {
  if (status === 'resolved') return 'resolved';
  if (['under_review', 'action_required'].includes(status)) return 'review';
  return 'response';
}

export function filterIncidentQueue<Incident extends IncidentQueueView>(
  incidents: Incident[],
  severity: string,
  stage: IncidentStageView,
) {
  return incidents.filter((incident) => {
    if (severity !== 'all' && incident.severity !== severity) return false;
    return stage === 'all' || getIncidentStage(incident.status) === stage;
  });
}

export function summarizeIncidentQueue(incidents: IncidentQueueView[]) {
  return {
    open: incidents.length,
    highSeverity: incidents.filter((incident) =>
      ['critical', 'serious'].includes(incident.severity),
    ).length,
    managerReview: incidents.filter((incident) => incident.manager_review_required).length,
    customerPending: incidents.filter((incident) => !incident.customer_notified).length,
  };
}
