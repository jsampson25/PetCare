import { describe, expect, it } from 'vitest';

import { filterReportCardQueue, summarizeReportCardQueue } from './report-card-queue-view';

const cards = [
  { id: 'boarding-draft', service_category: 'boarding', status: 'draft' },
  { id: 'daycare-review', service_category: 'daycare', status: 'review' },
  { id: 'grooming-correction', service_category: 'grooming', status: 'correction_review' },
  { id: 'boarding-approved', service_category: 'boarding', status: 'approved' },
  { id: 'boarding-published', service_category: 'boarding', status: 'published' },
];

describe('report-card queue view', () => {
  it('combines service and publishing-stage filters', () => {
    expect(filterReportCardQueue(cards, 'boarding', 'approved').map((card) => card.id)).toEqual([
      'boarding-approved',
    ]);
    expect(filterReportCardQueue(cards, 'all', 'review').map((card) => card.id)).toEqual([
      'daycare-review',
      'grooming-correction',
    ]);
  });

  it('summarizes draft through delivery workload', () => {
    expect(summarizeReportCardQueue(cards, 2)).toEqual({
      available: 2,
      authoring: 1,
      review: 2,
      approved: 1,
      published: 1,
    });
  });
});
