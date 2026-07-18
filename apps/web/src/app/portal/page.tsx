import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import Link from 'next/link';

import { resolvePortalDashboard } from '../../lib/auth/portal-context';

export default async function PortalPage() {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  const upcoming = dashboard.bookings
    .flatMap((booking) => booking.items.map((item) => ({ ...item, booking })))
    .filter((item) => new Date(item.ends_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const due = dashboard.invoices.reduce((sum, invoice) => sum + invoice.balance_due_minor, 0);
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Customer portal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Welcome back, {dashboard.customer.preferred_name ?? dashboard.customer.first_name}
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Manage your household’s pets and care with {dashboard.business.name}.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Pets">
          <p className="text-3xl font-black">{dashboard.pets.length}</p>
          <Link
            className="mt-3 inline-block font-bold text-[var(--action-primary)]"
            href="/portal/pets"
          >
            Review pet profiles
          </Link>
        </Card>
        <Card title="Open balance">
          <p className="text-3xl font-black">${(due / 100).toFixed(2)}</p>
          <Link
            className="mt-3 inline-block font-bold text-[var(--action-primary)]"
            href="/portal/billing"
          >
            View billing
          </Link>
        </Card>
        <Card title="Report cards">
          <p className="text-3xl font-black">{dashboard.report_cards.length}</p>
          <Link
            className="mt-3 inline-block font-bold text-[var(--action-primary)]"
            href="/portal/report-cards"
          >
            See care updates
          </Link>
        </Card>
      </div>
      {upcoming ? (
        <Card
          title="Upcoming reservation"
          description={`${upcoming.booking.booking_number} · ${upcoming.booking.location_name}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-black">
                {upcoming.pet_name} · {upcoming.service_name}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(upcoming.starts_at))}
              </p>
            </div>
            <Badge tone="success">{upcoming.booking.status.replaceAll('_', ' ')}</Badge>
          </div>
        </Card>
      ) : (
        <StatePanel
          title="No upcoming reservations"
          description="When care is booked, the confirmed dates and service details will appear here."
        />
      )}
    </div>
  );
}
