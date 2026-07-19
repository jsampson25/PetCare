import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { PortalPageHeader } from '../_components/portal-page-header';

export default async function ReportCardsPage() {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  return (
    <div className="space-y-6">
      <PortalPageHeader
        description="Staff-reviewed stories and highlights from your pet's time in care."
        eyebrow="Moments from their visit"
        title="Report cards"
      />
      {dashboard.report_cards.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {dashboard.report_cards.map((report, index) => (
            <Card className="overflow-hidden !p-0" key={report.id}>
              <div
                className={`relative h-28 ${index % 2 ? 'bg-[linear-gradient(135deg,#dbe9f4,#eef7f1)]' : 'bg-[linear-gradient(135deg,#dceee2,#f8f1dc)]'}`}
              >
                <span className="absolute bottom-4 left-5 grid size-14 place-items-center rounded-2xl border-4 border-white bg-[var(--action-primary)] text-lg font-black text-white">
                  {report.pet_name.slice(0, 2).toUpperCase()}
                </span>
                <span className="absolute right-5 top-4">
                  <Badge tone="success">Published</Badge>
                </span>
              </div>
              <article className="p-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--action-primary)]">
                  {report.service_category.replaceAll('_', ' ')}
                </p>
                <h2 className="mt-1 text-xl font-black">{report.pet_name}&apos;s care update</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(report.published_at))}
                </p>
                <p className="mt-5 leading-7">{report.narrative}</p>
                {Object.keys(report.highlights).length ? (
                  <dl className="mt-5 grid gap-3 rounded-xl bg-[var(--surface-subtle)] p-4 sm:grid-cols-2">
                    {Object.entries(report.highlights).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-[0.68rem] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]">
                          {key.replaceAll('_', ' ')}
                        </dt>
                        <dd className="mt-0.5 font-bold">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
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
