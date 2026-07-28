import { describe, expect, it } from 'vitest';

import { summarizeBookingItems } from './booking-list';

describe('booking list summaries', () => {
  it('uses the earliest scheduled item and reports additional services', () => {
    expect(
      summarizeBookingItems([
        {
          ends_at: '2026-08-04T12:00:00.000Z',
          pets: { name: 'Milo' },
          service_versions: { customer_name: 'Full Groom' },
          starts_at: '2026-08-04T10:00:00.000Z',
        },
        {
          ends_at: '2026-08-03T17:00:00.000Z',
          pets: { name: 'Milo' },
          service_versions: { customer_name: 'Daycare' },
          starts_at: '2026-08-03T08:00:00.000Z',
        },
      ]),
    ).toEqual({
      additionalItemCount: 1,
      endsAt: '2026-08-03T17:00:00.000Z',
      petName: 'Milo',
      serviceName: 'Daycare',
      startsAt: '2026-08-03T08:00:00.000Z',
    });
  });

  it('returns safe labels when relationships are unavailable', () => {
    expect(
      summarizeBookingItems([
        {
          ends_at: '2026-08-03T17:00:00.000Z',
          pets: null,
          service_versions: null,
          starts_at: '2026-08-03T08:00:00.000Z',
        },
      ]),
    ).toMatchObject({ petName: 'Pet not assigned', serviceName: 'Service not assigned' });
    expect(summarizeBookingItems([])).toBeNull();
  });
});
