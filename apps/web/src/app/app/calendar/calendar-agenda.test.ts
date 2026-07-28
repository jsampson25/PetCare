import { describe, expect, it } from 'vitest';

import {
  buildAgendaDays,
  groupItemsByAgendaDay,
  isCalendarDateKey,
  shiftCalendarDateKey,
} from './calendar-agenda';

describe('calendar agenda', () => {
  it('validates and shifts date keys across calendar boundaries', () => {
    expect(isCalendarDateKey('2026-07-27')).toBe(true);
    expect(isCalendarDateKey('2026-02-30')).toBe(false);
    expect(isCalendarDateKey('07/27/2026')).toBe(false);
    expect(shiftCalendarDateKey('2026-12-30', 7)).toBe('2027-01-06');
  });

  it('places a multi-day stay on every overlapping agenda day', () => {
    const days = buildAgendaDays('2026-07-27', 4);
    const stay = {
      ends_at: '2026-07-30T10:00:00.000Z',
      id: 'stay-1',
      starts_at: '2026-07-27T15:00:00.000Z',
    };

    const grouped = groupItemsByAgendaDay([stay], days);

    expect(grouped.get('2026-07-27')).toEqual([stay]);
    expect(grouped.get('2026-07-28')).toEqual([stay]);
    expect(grouped.get('2026-07-29')).toEqual([stay]);
    expect(grouped.get('2026-07-30')).toEqual([stay]);
  });

  it('excludes invalid and non-overlapping items', () => {
    const days = buildAgendaDays('2026-07-27', 2);
    const grouped = groupItemsByAgendaDay(
      [
        { ends_at: '2026-07-26T12:00:00.000Z', starts_at: '2026-07-26T10:00:00.000Z' },
        { ends_at: 'invalid', starts_at: 'invalid' },
      ],
      days,
    );

    expect(grouped.get('2026-07-27')).toEqual([]);
    expect(grouped.get('2026-07-28')).toEqual([]);
  });
});
