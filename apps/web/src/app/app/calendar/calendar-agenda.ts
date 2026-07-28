export type AgendaDay = {
  end: Date;
  key: string;
  start: Date;
};

type AgendaItem = {
  ends_at: string;
  starts_at: string;
};

export function isCalendarDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftCalendarDateKey(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildAgendaDays(startingDate: string, count = 7): AgendaDay[] {
  return Array.from({ length: count }, (_, index) => {
    const key = shiftCalendarDateKey(startingDate, index);
    const start = new Date(`${key}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { end, key, start };
  });
}

export function groupItemsByAgendaDay<Item extends AgendaItem>(items: Item[], days: AgendaDay[]) {
  const grouped = new Map(days.map((day) => [day.key, [] as Item[]]));

  for (const item of items) {
    const startsAt = new Date(item.starts_at);
    const endsAt = new Date(item.ends_at);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)
      continue;

    for (const day of days) {
      if (startsAt < day.end && endsAt > day.start) grouped.get(day.key)?.push(item);
    }
  }

  return grouped;
}
