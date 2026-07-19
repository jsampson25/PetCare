import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { submitBookingRequest } from '../actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  const parameters = await searchParams;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--action-primary)]">
            Your care history
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Reservations</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Upcoming stays and every visit your household has booked.
          </p>
        </div>
        <a
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--action-primary)] px-5 py-3 text-sm font-bold text-white shadow-sm"
          href="/book"
        >
          Book new care
        </a>
      </header>
      {typeof parameters.error === 'string' ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 font-bold text-red-900">
          {parameters.error}
        </p>
      ) : null}
      {dashboard.bookings.length ? (
        <div className="grid gap-5">
          {dashboard.bookings.map((booking) => (
            <Card className="overflow-hidden !p-0" key={booking.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--surface-subtle)] px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Confirmation
                  </p>
                  <p className="mt-1 font-black">
                    {booking.booking_number} · {booking.location_name}
                  </p>
                </div>
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
              <div className="p-6">
                <div className="grid gap-3">
                  {booking.items.map((item) => (
                    <div
                      className="relative rounded-xl border border-[var(--border-default)] bg-white p-4 pl-6"
                      key={item.id}
                    >
                      <span
                        className="absolute bottom-4 left-0 top-4 w-1 rounded-r bg-[var(--action-primary)]"
                        aria-hidden="true"
                      />
                      <p className="font-black">
                        {item.pet_name} · {item.service_name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {dateTime(item.starts_at)} – {dateTime(item.ends_at)}
                      </p>
                    </div>
                  ))}
                </div>
                {!['cancelled', 'completed', 'expired', 'no_show'].includes(booking.status) ? (
                  <form
                    action={submitBookingRequest}
                    className="mt-5 grid gap-3 border-t border-[var(--border-default)] pt-5 md:grid-cols-2"
                  >
                    <input name="bookingId" type="hidden" value={booking.id} />
                    <label className="text-sm font-bold">
                      Request type
                      <select
                        className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-white px-3"
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
                        className="mt-2 min-h-28 w-full rounded-xl border border-[var(--border-strong)] bg-white p-3"
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
              </div>
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
