import { Badge } from '@petcare/ui/badge';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--text-secondary)]">Reservations</p>
          <h1 className="text-3xl font-black tracking-tight">Calendar agenda</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Seven-day authoritative schedule with an accessible list presentation.
          </p>
        </div>
        <ButtonLink href="/app/bookings/new">New booking</ButtonLink>
      </header>
      <Card title="Choose week">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-sm font-bold">
            Starting date
            <input
              className="ml-2 min-h-11 rounded-lg border bg-white px-3"
              defaultValue={requestedDate}
              name="date"
              type="date"
            />
          </label>
          <label className="text-sm font-bold">
            Location
            <select
              className="ml-2 min-h-11 rounded-lg border bg-white px-3"
              defaultValue={requestedLocation}
              name="location"
            >
              <option value="all">All locations</option>
              {locations?.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Item status
            <select
              className="ml-2 min-h-11 rounded-lg border bg-white px-3"
              defaultValue={requestedStatus}
              name="status"
            >
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="held">Held</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <button
            className="min-h-11 rounded-lg bg-[var(--action-primary)] px-5 text-sm font-bold text-[var(--action-primary-text)]"
            type="submit"
          >
            Show week
          </button>
        </form>
      </Card>
      {[...Array(7)].map((_, index) => {
        const date = new Date(start);
        date.setDate(date.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        const dayItems = grouped.get(key) ?? [];
        return (
          <Card
            key={key}
            title={new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(date)}
            description={`${dayItems.length} scheduled service item${dayItems.length === 1 ? '' : 's'}`}
          >
            {dayItems.length ? (
              <div className="divide-y">
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
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      href={`/app/bookings/${item.booking_id}`}
                      key={item.id}
                    >
                      <div>
                        <p className="font-bold">
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
              <p className="text-sm text-[var(--text-secondary)]">Nothing scheduled.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
