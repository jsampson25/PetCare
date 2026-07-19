import { Badge } from '@petcare/ui/badge';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import Link from 'next/link';

import { resolvePortalDashboard } from '../../lib/auth/portal-context';

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export default async function PortalPage() {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  const upcoming = dashboard.bookings
    .flatMap((booking) => booking.items.map((item) => ({ ...item, booking })))
    .filter((item) => new Date(item.ends_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const due = dashboard.invoices.reduce((sum, invoice) => sum + invoice.balance_due_minor, 0);
  const firstName = dashboard.customer.preferred_name ?? dashboard.customer.first_name;
  const metrics = [
    {
      href: '/portal/pets',
      label: 'Pet profiles',
      value: dashboard.pets.length,
      note: 'Care details in one place',
    },
    {
      href: '/portal/billing',
      label: 'Open balance',
      value: `$${(due / 100).toFixed(2)}`,
      note: due ? 'Payment may be needed' : 'You are all caught up',
    },
    {
      href: '/portal/report-cards',
      label: 'Care updates',
      value: dashboard.report_cards.length,
      note: 'Photos, notes, and highlights',
    },
  ];
  return (
    <div className="space-y-8">
      <section className="soft-grid relative overflow-hidden rounded-[2rem] bg-[#173f30] px-6 py-8 text-white shadow-[var(--elevation-2)] sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-200">
            Your pet care home
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">
            Good to see you, {firstName}.
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-emerald-50/80">
            Everything for your pets, reservations, and care updates with {dashboard.business.name}{' '}
            is right here.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/book">Book care</ButtonLink>
            <a
              className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
              href="/portal/messages"
            >
              Message the care team
            </a>
          </div>
        </div>
        <div
          className="absolute -bottom-20 -right-14 size-64 rounded-full bg-emerald-300/10"
          aria-hidden="true"
        />
        <div
          className="absolute right-16 top-8 size-24 rounded-full border border-white/10"
          aria-hidden="true"
        />
      </section>

      <section aria-labelledby="account-summary">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--action-primary)]">
              At a glance
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight" id="account-summary">
              Your care summary
            </h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric, index) => (
            <Link
              className="group rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--elevation-1)] transition hover:-translate-y-0.5 hover:border-[var(--action-primary)]"
              href={metric.href}
              key={metric.label}
            >
              <div className="flex items-start justify-between">
                <span
                  className="grid size-10 place-items-center rounded-xl bg-[var(--surface-subtle)] font-black text-[var(--action-primary)]"
                  aria-hidden="true"
                >
                  0{index + 1}
                </span>
                <span
                  className="text-xl text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--action-primary)]"
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
              <p className="mt-6 text-3xl font-black tracking-tight">{metric.value}</p>
              <p className="mt-1 font-bold">{metric.label}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{metric.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        {upcoming ? (
          <Card className="overflow-hidden !p-0" title="">
            <div className="border-b border-[var(--border-default)] bg-[var(--surface-subtle)] px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--action-primary)]">
                    Coming up next
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {upcoming.pet_name}&apos;s {upcoming.service_name}
                  </h2>
                </div>
                <Badge tone="success">{upcoming.booking.status.replaceAll('_', ' ')}</Badge>
              </div>
            </div>
            <div className="p-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Starts
                  </p>
                  <p className="mt-1 font-bold">{dateTime(upcoming.starts_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Location
                  </p>
                  <p className="mt-1 font-bold">{upcoming.booking.location_name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Confirmation
                  </p>
                  <p className="mt-1 font-bold">{upcoming.booking.booking_number}</p>
                </div>
              </div>
              <Link
                className="mt-6 inline-block text-sm font-extrabold text-[var(--action-primary)]"
                href="/portal/reservations"
              >
                View reservation details →
              </Link>
            </div>
          </Card>
        ) : (
          <StatePanel
            title="Ready when you are"
            description="You do not have upcoming care booked. Choose a service when your pet needs their next stay, play day, or groom."
          />
        )}
        <Card
          title="Your pet family"
          description={`${dashboard.pets.length} pet${dashboard.pets.length === 1 ? '' : 's'} connected`}
        >
          <div className="flex -space-x-2">
            {dashboard.pets.slice(0, 4).map((pet) => (
              <span
                className="grid size-12 place-items-center rounded-full border-2 border-white bg-[#dcebe1] text-sm font-black text-[#17563d]"
                key={pet.id}
                title={pet.name}
              >
                {pet.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            {dashboard.pets.slice(0, 3).map((pet) => (
              <div className="flex items-center justify-between" key={pet.id}>
                <span className="font-bold">{pet.name}</span>
                <span className="text-sm text-[var(--text-secondary)]">{pet.breed}</span>
              </div>
            ))}
          </div>
          <Link
            className="mt-5 inline-block text-sm font-extrabold text-[var(--action-primary)]"
            href="/portal/pets"
          >
            Manage pet profiles →
          </Link>
        </Card>
      </div>
    </div>
  );
}
