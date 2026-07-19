import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import Link from 'next/link';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';

export default async function PetsPage() {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--action-primary)]">
            Your family
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Pet profiles</h1>
          <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
            Keep the care team ready with current identity and vaccination information.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] bg-white px-4 py-2 text-sm font-bold shadow-sm"
          href="/portal/requests"
        >
          Request a profile update
        </Link>
      </header>
      {dashboard.pets.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {dashboard.pets.map((pet) => (
            <Card className="overflow-hidden !p-0" key={pet.id}>
              <div className="flex items-center gap-4 border-b border-[var(--border-default)] bg-[linear-gradient(135deg,#edf6f0,#fff)] p-6">
                <span
                  className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#d6eadc] text-xl font-black text-[#155b3d]"
                  aria-hidden="true"
                >
                  {pet.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-tight">{pet.name}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {pet.breed} · {pet.sex}
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black">Vaccination readiness</h3>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {pet.vaccinations.length} records
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {pet.vaccinations.length ? (
                    pet.vaccinations.map((vaccine) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-canvas)] p-3.5"
                        key={vaccine.id}
                      >
                        <div>
                          <p className="font-bold capitalize">
                            {vaccine.type.replaceAll('_', ' ')}
                          </p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            Expires{' '}
                            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                              new Date(`${vaccine.expires_on}T00:00:00`),
                            )}
                          </p>
                        </div>
                        <Badge tone={vaccine.review_status === 'accepted' ? 'success' : 'warning'}>
                          {vaccine.review_status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-[var(--surface-canvas)] p-4 text-sm text-[var(--text-secondary)]">
                      No vaccination records are currently available.
                    </p>
                  )}
                </div>
                <div className="mt-5 border-t border-[var(--border-default)] pt-4">
                  <Link
                    className="text-sm font-extrabold text-[var(--action-primary)]"
                    href="/portal/requests"
                  >
                    Ask the care team to update {pet.name}&apos;s profile →
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <StatePanel
          title="No pets"
          description="Contact the business if a household pet is missing."
        />
      )}
    </div>
  );
}
