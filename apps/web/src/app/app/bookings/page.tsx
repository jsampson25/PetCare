import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

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
  const supabase = await createSupabaseServerClient();
  const [{ data: bookings }, { data: waitlist }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id,booking_number,status,source_channel,created_at,customers(first_name,last_name),locations(name)',
      )
      .eq('business_id', context.businessId)
      .order('created_at', { ascending: false }),
    supabase
      .from('waitlist_entries')
      .select(
        'id,status,preferred_start,preferred_end,quantity,customers(first_name,last_name),pets(name),services(internal_name)',
      )
      .eq('business_id', context.businessId)
      .in('status', ['active', 'offered'])
      .order('priority_created_at'),
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
                  <Badge tone="info">{entry.status}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No active waitlist demand.</p>
        )}
      </Card>
    </div>
  );
}
