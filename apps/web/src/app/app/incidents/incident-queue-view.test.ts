import { describe, expect, it } from 'vitest';

import {
  filterIncidentQueue,
  getIncidentStage,
  summarizeIncidentQueue,
} from './incident-queue-view';

const incidents = [
  {
    id: 'critical-response',
    severity: 'critical',
    status: 'stabilizing',
    manager_review_required: true,
    customer_notified: false,
  },
  {
    id: 'serious-review',
    severity: 'serious',
    status: 'under_review',
    manager_review_required: true,
    customer_notified: true,
  },
  {
    id: 'minor-resolved',
    severity: 'minor',
    status: 'resolved',
    manager_review_required: false,
    customer_notified: false,
  },
];

describe('incident queue view', () => {
  it('groups workflow statuses into response stages', () => {
    expect(getIncidentStage('monitoring')).toBe('response');
    expect(getIncidentStage('action_required')).toBe('review');
    expect(getIncidentStage('resolved')).toBe('resolved');
  });

  it('combines severity and response-stage filters', () => {
    expect(filterIncidentQueue(incidents, 'serious', 'review').map((item) => item.id)).toEqual([
      'serious-review',
    ]);
    expect(filterIncidentQueue(incidents, 'all', 'response').map((item) => item.id)).toEqual([
      'critical-response',
    ]);
  });

  it('summarizes safety and communication attention', () => {
    expect(summarizeIncidentQueue(incidents)).toEqual({
      open: 3,
      highSeverity: 2,
      managerReview: 2,
      customerPending: 2,
    });
  });
});
