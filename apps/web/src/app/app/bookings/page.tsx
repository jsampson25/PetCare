import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Field } from '@petcare/ui/field';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { RecordList, RecordListItem } from '@petcare/ui/record-list';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  acceptWaitlistOffer,
  declineWaitlistOffer,
  expireBookingRequests,
  offerWaitlistEntry,
} from './actions';
import { type BookingListItem, summarizeBookingItems } from './booking-list';

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
      'id,booking_number,status,source_channel,created_at,customers(first_name,last_name),locations(name),booking_items(starts_at,ends_at,pets(name),service_versions(customer_name))',
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
      <PageHeader
        actions={
          context.permissions.has('bookings.create') ? (
            <ButtonLink href="/app/bookings/new" leadingIcon={<Icon name="add" />}>
              New booking
            </ButtonLink>
          ) : null
        }
        description="Authoritative requests, confirmations, and exceptions across every service."
        eyebrow="Reservations"
        title="Bookings"
      />
      <CommandBar
        secondaryAction={
          context.permissions.has('bookings.modify') ? (
            <form action={expireBookingRequests}>
              <Button leadingIcon={<Icon name="refresh" />} type="submit" variant="quiet">
                Process expired requests
              </Button>
            </form>
          ) : null
        }
        title="Find bookings"
        description="Search the authoritative booking number and narrow the lifecycle state."
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <Field
            defaultValue={query}
            density="compact"
            label="Booking number"
            name="q"
            placeholder="PC-000123"
          />
          <SelectField defaultValue={status} density="compact" label="Status" name="status">
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="action_required">Action required</option>
            <option value="pending_approval">Pending approval</option>
            <option value="pending_deposit">Pending deposit</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
            <option value="expired">Expired</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
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
      <Card eyebrow="Booking summary" title="Current view" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Visible records</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{bookings?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Confirmed</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">
              {bookings?.filter((booking) => booking.status === 'confirmed').length ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Needs attention</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">
              {bookings?.filter((booking) =>
                ['action_required', 'pending_approval', 'pending_deposit'].includes(booking.status),
              ).length ?? 0}
            </dd>
          </div>
        </dl>
      </Card>
      <Card
        description="A pending request is never presented as a confirmed reservation."
        eyebrow="Reservation records"
        title="Recent bookings"
      >
        {bookings?.length ? (
          <RecordList>
            {bookings.map((booking) => {
              const customer = booking.customers as unknown as {
                first_name: string;
                last_name: string;
              } | null;
              const location = booking.locations as unknown as { name: string } | null;
              const schedule = summarizeBookingItems(
                (booking.booking_items as unknown as BookingListItem[]) ?? [],
              );
              return (
                <RecordListItem
                  action={
                    <ButtonLink
                      href={`/app/bookings/${booking.id}`}
                      leadingIcon={<Icon name="arrow-right" />}
                      variant="secondary"
                    >
                      View booking
                    </ButtonLink>
                  }
                  description={
                    <div className="space-y-1">
                      <p>
                        {customer?.first_name} {customer?.last_name} · {location?.name} ·{' '}
                        {booking.source_channel.replaceAll('_', ' ')}
                      </p>
                      {schedule ? (
                        <p className="font-semibold text-[var(--text-primary)]">
                          {schedule.petName} · {schedule.serviceName} ·{' '}
                          <time dateTime={schedule.startsAt}>
                            {new Intl.DateTimeFormat('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(schedule.startsAt))}
                          </time>{' '}
                          –{' '}
                          <time dateTime={schedule.endsAt}>
                            {new Intl.DateTimeFormat('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(schedule.endsAt))}
                          </time>
                          {schedule.additionalItemCount
                            ? ` · +${schedule.additionalItemCount} more service${schedule.additionalItemCount === 1 ? '' : 's'}`
                            : ''}
                        </p>
                      ) : (
                        <p>Schedule pending</p>
                      )}
                    </div>
                  }
                  key={booking.id}
                  leading={
                    <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)] text-[var(--action-primary)]">
                      <Icon name="booking" />
                    </span>
                  }
                  status={
                    <Badge tone={tone(booking.status) as 'danger' | 'info' | 'success' | 'warning'}>
                      {booking.status.replaceAll('_', ' ')}
                    </Badge>
                  }
                  title={booking.booking_number}
                />
              );
            })}
          </RecordList>
        ) : (
          <StatePanel
            action={
              context.permissions.has('bookings.create') ? (
                <ButtonLink href="/app/bookings/new" leadingIcon={<Icon name="add" />}>
                  Create booking
                </ButtonLink>
              ) : null
            }
            description="Adjust the filters or create the first booking request."
            size="compact"
            title="No bookings in this view"
          />
        )}
      </Card>
      <Card
        description="Priority is chronological; every offer must revalidate eligibility, capacity, pricing, and policy."
        eyebrow="Capacity recovery"
        title="Active waitlist"
      >
        {waitlist?.length ? (
          <RecordList>
            {waitlist.map((entry) => {
              const customer = entry.customers as unknown as {
                first_name: string;
                last_name: string;
              } | null;
              const pet = entry.pets as unknown as { name: string } | null;
              const service = entry.services as unknown as { internal_name: string } | null;
              return (
                <RecordListItem
                  action={
                    entry.status === 'active' && context.permissions.has('bookings.modify') ? (
                      <form action={offerWaitlistEntry}>
                        <input name="entryId" type="hidden" value={entry.id} />
                        <Button
                          leadingIcon={<Icon name="arrow-right" />}
                          type="submit"
                          variant="secondary"
                        >
                          Offer slot
                        </Button>
                      </form>
                    ) : null
                  }
                  description={
                    <>
                      {customer?.first_name} {customer?.last_name} ·{' '}
                      {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                        new Date(entry.preferred_start),
                      )}
                    </>
                  }
                  key={entry.id}
                  status={<Badge tone="info">{entry.status}</Badge>}
                  title={
                    <>
                      {pet?.name} · {service?.internal_name}
                    </>
                  }
                />
              );
            })}
          </RecordList>
        ) : (
          <StatePanel
            description="Customers waiting for unavailable dates will appear here."
            size="compact"
            title="No active waitlist demand"
          />
        )}
      </Card>
      <Card
        description="Offers retain a dedicated capacity hold and expire without creating a reservation."
        eyebrow="Capacity offers"
        title="Timed offers"
      >
        {offers?.length ? (
          <RecordList>
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
                <RecordListItem
                  action={
                    <div className="flex flex-wrap gap-2">
                      <form action={acceptWaitlistOffer}>
                        <input name="offerId" type="hidden" value={offer.id} />
                        <input name="units" type="hidden" value={units} />
                        <Button leadingIcon={<Icon name="check" />} type="submit">
                          Convert
                        </Button>
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
                  }
                  description={
                    <>
                      {entry?.customers?.first_name} {entry?.customers?.last_name} · expires{' '}
                      {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(
                        new Date(offer.deadline_at),
                      )}
                    </>
                  }
                  key={offer.id}
                  status={<Badge tone="warning">offer pending</Badge>}
                  title={
                    <>
                      {entry?.pets?.name} · {entry?.services?.internal_name}
                    </>
                  }
                />
              );
            })}
          </RecordList>
        ) : (
          <StatePanel
            description="Time-limited capacity offers will appear here until accepted or expired."
            size="compact"
            title="No active offers"
          />
        )}
      </Card>
    </div>
  );
}
