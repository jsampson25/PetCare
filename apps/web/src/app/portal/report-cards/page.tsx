import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
export default async function ReportCardsPage() {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Care updates</p>
        <h1 className="mt-2 text-3xl font-black">Report cards</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Only staff-reviewed and published updates appear here.
        </p>
      </header>
      {d.report_cards.length ? (
        <div className="grid gap-5">
          {d.report_cards.map((card) => (
            <Card
              key={card.id}
              title={`${card.pet_name} · ${card.service_category}`}
              description={new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(card.published_at))}
            >
              <Badge tone="success">Published</Badge>
              <p className="mt-4 leading-7">{card.narrative}</p>
              {Object.keys(card.highlights).length ? (
                <dl className="mt-4 grid gap-2 rounded-lg bg-[var(--surface-subtle)] p-4 sm:grid-cols-2">
                  {Object.entries(card.highlights).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                        {key.replaceAll('_', ' ')}
                      </dt>
                      <dd className="font-bold">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <StatePanel
          title="No published report cards"
          description="Reviewed care updates will remain available here after publication."
        />
      )}
    </div>
  );
}
