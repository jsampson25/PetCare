import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  acceptWaitlistOffer,
  declineWaitlistOffer,
  expireBookingRequests,
  offerWaitlistEntry,
} from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const tone = (status: string) =>
  status === 'confirmed'
    ? 'success'
    : status === 'cancelled' || status === 'expired'
      ? 'danger'
      : status === 'action_required' || status === 'pending_deposit'
        ? 'warning'
        : 'info';

export default async function BookingsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.view')) redirect('/denied');
  const parameters = await searchParams;
  const query = typeof parameters.q === 'string' ? parameters.q.trim() : '';
  const status = typeof parameters.status === 'string' ? parameters.status : 'active';
  const supabase = await createSupabaseServerClient();
  let bookingQuery = supabase
    .from('bookings')
    .select(
      'id,booking_number,status,source_channel,created_at,customers(first_name,last_name),locations(name)',
    )
    .eq('business_id', context.businessId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status === 'active')
    bookingQuery = bookingQuery.in('status', [
      'action_required',
      'pending_approval',
      'pending_deposit',
      'confirmed',
    ]);
  else if (status !== 'all') bookingQuery = bookingQuery.eq('status', status);
  if (query) bookingQuery = bookingQuery.ilike('booking_number', `%${query}%`);
  const [{ data: bookings }, { data: waitlist }, { data: offers }] = await Promise.all([
    bookingQuery,
    supabase
      .from('waitlist_entries')
      .select(
        'id,status,preferred_start,preferred_end,quantity,customers(first_name,last_name),pets(name),services(internal_name)',
      )
      .eq('business_id', context.businessId)
      .in('status', ['active', 'offered'])
      .order('priority_created_at'),
    supabase
      .from('waitlist_offers')
      .select(
        'id,deadline_at,status,waitlist_entries(preferred_start,preferred_end,pets(name),services(internal_name),customers(first_name,last_name))',
      )
      .eq('business_id', context.businessId)
      .eq('status', 'offered')
      .order('deadline_at'),
  ]);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--text-secondary)]">Reservations</p>
          <h1 className="text-3xl font-black tracking-tight">Bookings</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Authoritative requests, confirmations, and exceptions across every service.
          </p>
        </div>
        {context.permissions.has('bookings.create') ? (
          <ButtonLink href="/app/bookings/new">New booking</ButtonLink>
        ) : null}
      </header>
      <Card
        title="Find bookings"
        description="Search the authoritative booking number and narrow the lifecycle state."
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-sm font-bold">
            Booking number
            <input
              className="mt-2 block min-h-11 rounded-lg border bg-white px-3"
              defaultValue={query}
              name="q"
              placeholder="PC-000123"
            />
          </label>
          <label className="text-sm font-bold">
            Status
            <select
              className="mt-2 block min-h-11 rounded-lg border bg-white px-3"
              defaultValue={status}
              name="status"
            >
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="action_required">Action required</option>
              <option value="pending_approval">Pending approval</option>
              <option value="pending_deposit">Pending deposit</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
        {context.permissions.has('bookings.modify') ? (
          <form action={expireBookingRequests} className="mt-4 border-t pt-4">
            <Button type="submit" variant="quiet">
              Process expired requests
            </Button>
          </form>
        ) : null}
      </Card>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Booking updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Booking update failed" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <Card
        title="Recent bookings"
        description="A pending request is never presented as a confirmed reservation."
      >
        {bookings?.length ? (
          <div className="divide-y">
            {bookings.map((booking) => {
              const customer = booking.customers as unknown as {
                first_name: string;
                last_name: string;
              } | null;
              const location = booking.locations as unknown as { name: string } | null;
              return (
                <a
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  href={`/app/bookings/${booking.id}`}
                  key={booking.id}
                >
                  <div>
                    <p className="font-black">{booking.booking_number}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {customer?.first_name} {customer?.last_name} · {location?.name} ·{' '}
                      {booking.source_channel.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <Badge tone={tone(booking.status) as 'danger' | 'info' | 'success' | 'warning'}>
                    {booking.status.replaceAll('_', ' ')}
                  </Badge>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No booking requests have been created yet.
          </p>
        )}
      </Card>
      <Card
        title="Active waitlist"
        description="Priority is chronological; every offer must revalidate eligibility, capacity, pricing, and policy."
      >
        {waitlist?.length ? (
          <div className="divide-y">
            {waitlist.map((entry) => {
              const customer = entry.customers as unknown as {
                first_name: string;
                last_name: string;
              } | null;
              const pet = entry.pets as unknown as { name: string } | null;
              const service = entry.services as unknown as { internal_name: string } | null;
              return (
                <div
                  className="flex flex-wrap justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  key={entry.id}
                >
                  <div>
                    <p className="font-bold">
                      {pet?.name} · {service?.internal_name}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {customer?.first_name} {customer?.last_name} ·{' '}
                      {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                        new Date(entry.preferred_start),
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="info">{entry.status}</Badge>
                    {entry.status === 'active' && context.permissions.has('bookings.modify') ? (
                      <form action={offerWaitlistEntry}>
                        <input name="entryId" type="hidden" value={entry.id} />
                        <Button type="submit" variant="secondary">
                          Offer slot
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No active waitlist demand.</p>
        )}
      </Card>
      <Card
        title="Timed offers"
        description="Offers retain a dedicated capacity hold and expire without creating a reservation."
      >
        {offers?.length ? (
          <div className="divide-y">
            {offers.map((offer) => {
              const entry = offer.waitlist_entries as unknown as {
                preferred_start: string;
                preferred_end: string;
                pets: { name: string };
                services: { internal_name: string };
                customers: { first_name: string; last_name: string };
              };
              const units = Math.max(
                1,
                Math.ceil(
                  (new Date(entry.preferred_end).getTime() -
                    new Date(entry.preferred_start).getTime()) /
                    86_400_000,
                ),
              );
              return (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  key={offer.id}
                >
                  <div>
                    <p className="font-bold">
                      {entry?.pets?.name} · {entry?.services?.internal_name}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {entry?.customers?.first_name} {entry?.customers?.last_name} · expires{' '}
                      {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(
                        new Date(offer.deadline_at),
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={acceptWaitlistOffer}>
                      <input name="offerId" type="hidden" value={offer.id} />
                      <input name="units" type="hidden" value={units} />
                      <Button type="submit">Convert</Button>
                    </form>
                    {context.permissions.has('bookings.modify') ? (
                      <form action={declineWaitlistOffer}>
                        <input name="offerId" type="hidden" value={offer.id} />
                        <Button type="submit" variant="quiet">
                          Decline
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No active offers.</p>
        )}
      </Card>
    </div>
  );
}
