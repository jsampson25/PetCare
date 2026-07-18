import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
export default async function ReservationsPage() {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">My care</p>
        <h1 className="mt-2 text-3xl font-black">Reservations</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Confirmed historical and upcoming care for your household.
        </p>
      </header>
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
