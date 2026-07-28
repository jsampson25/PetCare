import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Field } from '@petcare/ui/field';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  buildAgendaDays,
  groupItemsByAgendaDay,
  isCalendarDateKey,
  shiftCalendarDateKey,
} from './calendar-agenda';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function CalendarPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.view')) redirect('/denied');
  const parameters = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const requestedDate =
    typeof parameters.date === 'string' && isCalendarDateKey(parameters.date)
      ? parameters.date
      : today;
  const requestedLocation = typeof parameters.location === 'string' ? parameters.location : 'all';
  const requestedStatus = typeof parameters.status === 'string' ? parameters.status : 'active';
  const agendaDays = buildAgendaDays(requestedDate);
  const start = agendaDays[0]!.start;
  const end = agendaDays.at(-1)!.end;
  const supabase = await createSupabaseServerClient();
  const { data: locations } = await supabase
    .from('locations')
    .select('id,name')
    .eq('business_id', context.businessId)
    .eq('status', 'active')
    .order('name');
  let calendarQuery = supabase
    .from('booking_items')
    .select(
      'id,booking_id,starts_at,ends_at,status,pets(name),service_versions(customer_name),bookings!inner(booking_number,status,location_id,customers(first_name,last_name),locations(name))',
    )
    .eq('business_id', context.businessId)
    .lt('starts_at', end.toISOString())
    .gt('ends_at', start.toISOString())
    .order('starts_at');
  if (requestedStatus === 'active')
    calendarQuery = calendarQuery.in('status', ['held', 'confirmed']);
  else if (requestedStatus !== 'all') calendarQuery = calendarQuery.eq('status', requestedStatus);
  if (requestedLocation !== 'all')
    calendarQuery = calendarQuery.eq('bookings.location_id', requestedLocation);
  const { data: items } = await calendarQuery;
  const grouped = groupItemsByAgendaDay(items ?? [], agendaDays);
  const uniquePets = new Set(
    (items ?? [])
      .map((item) => (item.pets as unknown as { name: string })?.name)
      .filter((name): name is string => Boolean(name)),
  );
  const confirmedItems = (items ?? []).filter(
    (item) => (item.bookings as unknown as { status: string })?.status === 'confirmed',
  ).length;
  const calendarHref = (date: string) => {
    const nextParameters = new URLSearchParams({ date });
    if (requestedLocation !== 'all') nextParameters.set('location', requestedLocation);
    if (requestedStatus !== 'active') nextParameters.set('status', requestedStatus);
    return `/app/calendar?${nextParameters.toString()}`;
  };
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink href="/app/bookings/new" leadingIcon={<Icon name="add" />}>
            New booking
          </ButtonLink>
        }
        description="Seven-day authoritative schedule with an accessible list presentation."
        eyebrow="Reservations"
        title="Calendar agenda"
      />
      <CommandBar
        description="Adjust the agenda window without changing the underlying reservation records."
        secondaryAction={
          <nav aria-label="Calendar navigation" className="flex flex-wrap gap-2">
            <ButtonLink
              href={calendarHref(shiftCalendarDateKey(requestedDate, -7))}
              variant="secondary"
            >
              Previous 7 days
            </ButtonLink>
            <ButtonLink href={calendarHref(today)} variant="secondary">
              Today
            </ButtonLink>
            <ButtonLink
              href={calendarHref(shiftCalendarDateKey(requestedDate, 7))}
              variant="secondary"
            >
              Next 7 days
            </ButtonLink>
          </nav>
        }
        title="Choose week"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <Field
            defaultValue={requestedDate}
            density="compact"
            label="Starting date"
            name="date"
            type="date"
          />
          <SelectField
            defaultValue={requestedLocation}
            density="compact"
            label="Location"
            name="location"
          >
            <option value="all">All locations</option>
            {locations?.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            defaultValue={requestedStatus}
            density="compact"
            label="Item status"
            name="status"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="held">Held</option>
            <option value="completed">Completed</option>
            <option value="no_show">No-show</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Show week
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Schedule summary" title="Seven-day outlook" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Scheduled items</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{items?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Pets</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{uniquePets.size}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Confirmed</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{confirmedItems}</dd>
          </div>
        </dl>
      </Card>
      {agendaDays.map((day) => {
        const date = day.start;
        const key = day.key;
        const dayItems = grouped.get(key) ?? [];
        return (
          <Card
            actions={
              <Badge tone={dayItems.length ? 'info' : 'neutral'}>
                {dayItems.length} item{dayItems.length === 1 ? '' : 's'}
              </Badge>
            }
            className={
              key === today ? 'overflow-hidden border-[var(--action-primary)]' : 'overflow-hidden'
            }
            eyebrow="Daily agenda"
            key={key}
            title={new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(date)}
          >
            {dayItems.length ? (
              <div className="divide-y divide-[var(--border-default)]">
                {dayItems.map((item) => {
                  const booking = item.bookings as unknown as {
                    booking_number: string;
                    status: string;
                    customers: { first_name: string; last_name: string };
                    locations: { name: string };
                  };
                  const pet = item.pets as unknown as { name: string };
                  const service = item.service_versions as unknown as { customer_name: string };
                  const startsToday = item.starts_at.slice(0, 10) === key;
                  const endsToday = item.ends_at.slice(0, 10) === key;
                  const scheduleLabel = startsToday
                    ? new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(
                        new Date(item.starts_at),
                      )
                    : endsToday
                      ? `Until ${new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(item.ends_at))}`
                      : 'Continuing stay';
                  return (
                    <a
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-[var(--surface-subtle)] first:pt-0 last:pb-0"
                      href={`/app/bookings/${item.booking_id}`}
                      key={item.id}
                    >
                      <div>
                        <p className="font-black">
                          {scheduleLabel} · {pet?.name} · {service?.customer_name}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {booking?.booking_number} · {booking?.customers?.first_name}{' '}
                          {booking?.customers?.last_name} · {booking?.locations?.name}
                        </p>
                      </div>
                      <Badge tone={booking?.status === 'confirmed' ? 'success' : 'warning'}>
                        {booking?.status.replaceAll('_', ' ')}
                      </Badge>
                    </a>
                  );
                })}
              </div>
            ) : (
              <StatePanel
                description="This day is clear for the selected location and status."
                size="compact"
                title="Nothing scheduled"
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}
