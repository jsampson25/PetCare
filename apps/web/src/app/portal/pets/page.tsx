import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
export default async function PetsPage() {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Household</p>
        <h1 className="mt-2 text-3xl font-black">My pets</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Identity and vaccination status used for service eligibility.
        </p>
      </header>
      {d.pets.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {d.pets.map((pet) => (
            <Card key={pet.id} title={pet.name} description={`${pet.breed} · ${pet.sex}`}>
              <h2 className="font-black">Vaccinations</h2>
              <div className="mt-3 grid gap-2">
                {pet.vaccinations.length ? (
                  pet.vaccinations.map((vaccine) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      key={vaccine.id}
                    >
                      <div>
                        <p className="font-bold">{vaccine.type.replaceAll('_', ' ')}</p>
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
                  <p className="text-sm text-[var(--text-secondary)]">
                    No vaccination records are currently available.
                  </p>
                )}
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
