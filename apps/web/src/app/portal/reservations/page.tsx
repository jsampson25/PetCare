import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { submitBookingRequest } from '../actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  const parameters = await searchParams;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">My care</p>
        <h1 className="mt-2 text-3xl font-black">Reservations</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Confirmed historical and upcoming care for your household.
        </p>
      </header>
      {typeof parameters.error === 'string' ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 font-bold text-red-900">
          {parameters.error}
        </p>
      ) : null}
      {d.bookings.length ? (
        <div className="grid gap-5">
          {d.bookings.map((booking) => (
            <Card
              key={booking.id}
              title={booking.booking_number}
              description={booking.location_name}
            >
              <div className="mb-4">
                <Badge
                  tone={
                    booking.status === 'confirmed'
                      ? 'success'
                      : booking.status === 'cancelled'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {booking.status.replaceAll('_', ' ')}
                </Badge>
              </div>
              <div className="grid gap-3">
                {booking.items.map((item) => (
                  <div className="rounded-lg border p-4" key={item.id}>
                    <p className="font-black">
                      {item.pet_name} · {item.service_name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.starts_at))}{' '}
                      –{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.ends_at))}
                    </p>
                  </div>
                ))}
              </div>
              {!['cancelled', 'completed', 'expired', 'no_show'].includes(booking.status) ? (
                <form
                  action={submitBookingRequest}
                  className="mt-5 grid gap-3 border-t pt-5 md:grid-cols-2"
                >
                  <input name="bookingId" type="hidden" value={booking.id} />
                  <label className="text-sm font-bold">
                    Request type
                    <select
                      className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
                      name="requestType"
                    >
                      <option value="booking_change">Request a change</option>
                      <option value="booking_cancellation">Request cancellation</option>
                    </select>
                  </label>
                  <Field label="Subject" name="subject" required />
                  <label className="text-sm font-bold md:col-span-2">
                    What should the care team review?
                    <textarea
                      className="mt-2 min-h-28 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] p-3"
                      name="message"
                      required
                    />
                  </label>
                  <div className="md:col-span-2">
                    <Button type="submit" variant="secondary">
                      Send request
                    </Button>
                  </div>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <StatePanel
          title="No reservations"
          description="Your confirmed and historical bookings will appear here."
        />
      )}
    </div>
  );
}
