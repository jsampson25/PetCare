import { describe, expect, it } from 'vitest';

import { filterCareObservations, summarizeCareObservations } from './care-log-view';

const observations = [
  {
    id: 'activity-info',
    category: 'activity',
    concern_level: 'information',
    customer_visible: true,
  },
  {
    id: 'wellness-warning',
    category: 'wellness',
    concern_level: 'warning',
    customer_visible: false,
  },
  {
    id: 'wellness-critical',
    category: 'wellness',
    concern_level: 'critical',
    customer_visible: false,
  },
];

describe('care log view', () => {
  it('combines category and concern filters', () => {
    expect(
      filterCareObservations(observations, 'wellness', 'attention').map((item) => item.id),
    ).toEqual(['wellness-warning', 'wellness-critical']);
    expect(filterCareObservations(observations, 'all', 'urgent').map((item) => item.id)).toEqual([
      'wellness-critical',
    ]);
  });

  it('summarizes attention, escalation, and customer visibility', () => {
    expect(summarizeCareObservations(observations)).toEqual({
      recorded: 3,
      attention: 2,
      urgent: 1,
      customerVisible: 1,
    });
  });
});
