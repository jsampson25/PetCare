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

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function CalendarPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.view')) redirect('/denied');
  const parameters = await searchParams;
  const requestedDate =
    typeof parameters.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parameters.date)
      ? parameters.date
      : new Date().toISOString().slice(0, 10);
  const requestedLocation = typeof parameters.location === 'string' ? parameters.location : 'all';
  const requestedStatus = typeof parameters.status === 'string' ? parameters.status : 'active';
  const start = new Date(`${requestedDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
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
  const grouped = new Map<string, typeof items>();
  for (const item of items ?? []) {
    const key = item.starts_at.slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
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
      {[...Array(7)].map((_, index) => {
        const date = new Date(start);
        date.setDate(date.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        const dayItems = grouped.get(key) ?? [];
        return (
          <Card
            actions={
              <Badge tone={dayItems.length ? 'info' : 'neutral'}>
                {dayItems.length} item{dayItems.length === 1 ? '' : 's'}
              </Badge>
            }
            className={
              index === 0 ? 'overflow-hidden border-[var(--action-primary)]' : 'overflow-hidden'
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
                  return (
                    <a
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-[var(--surface-subtle)] first:pt-0 last:pb-0"
                      href={`/app/bookings/${item.booking_id}`}
                      key={item.id}
                    >
                      <div>
                        <p className="font-black">
                          {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(
                            new Date(item.starts_at),
                          )}{' '}
                          · {pet?.name} · {service?.customer_name}
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
