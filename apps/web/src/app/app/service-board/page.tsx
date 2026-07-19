import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { initializeServiceExecution, transitionServiceExecution } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
const transitions: Record<string, Record<string, string[]>> = {
  boarding: {
    settling: ['active', 'hold'],
    active: ['departure_preparation', 'hold'],
    departure_preparation: ['ready', 'hold'],
    hold: ['active', 'departure_preparation'],
    ready: ['completed'],
  },
  daycare: {
    attendance: ['evaluation', 'playgroup', 'one_on_one'],
    evaluation: ['playgroup', 'one_on_one'],
    playgroup: ['resting', 'ready', 'hold'],
    resting: ['playgroup', 'ready'],
    one_on_one: ['resting', 'ready'],
    hold: ['one_on_one', 'ready'],
    ready: ['completed'],
  },
  grooming: {
    intake: ['bathing', 'processing', 'hold'],
    bathing: ['processing', 'drying'],
    processing: ['drying', 'finishing'],
    drying: ['finishing'],
    finishing: ['quality_review'],
    quality_review: ['finishing', 'ready'],
    hold: ['intake', 'processing'],
    ready: ['completed'],
  },
};

export default async function ServiceBoardPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.execute_service')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: executions }, { data: petVisits }] = await Promise.all([
    supabase
      .from('service_executions')
      .select(
        'id,pet_visit_id,service_category,stage,started_at,ready_at,pets(name,breed),locations(name),service_versions(customer_name)',
      )
      .eq('business_id', context.businessId)
      .neq('stage', 'completed')
      .order('updated_at'),
    supabase
      .from('pet_visits')
      .select(
        'id,pets(name,breed),booking_items(service_versions(customer_name,services(category)))',
      )
      .eq('business_id', context.businessId)
      .eq('status', 'in_care')
      .eq('handoff_status', 'accepted'),
  ]);
  const activePetIds = new Set((executions ?? []).map((execution) => execution.pet_visit_id));
  const unstarted = (petVisits ?? []).filter((visit) => {
    const item = visit.booking_items as unknown as {
      service_versions: { services: { category: string } | null } | null;
    } | null;
    return (
      !activePetIds.has(visit.id) &&
      ['boarding', 'daycare', 'grooming'].includes(item?.service_versions?.services?.category ?? '')
    );
  });
  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] bg-[#173f30] p-7 text-white shadow-[var(--elevation-2)] sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Daily operations
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Service boards</h1>
        <p className="mt-2 text-emerald-50/75">
          Boarding, daycare, and grooming keep distinct operational stages and one shared visit
          timeline.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Board updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Stage unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {unstarted.length ? (
        <Card
          className="border-emerald-100 bg-[linear-gradient(135deg,#f1f8f3,#fff)]"
          title="Ready to start"
          description="Custody handoff is complete; initialize the category-specific workflow."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {unstarted.map((visit) => {
              const pet = visit.pets as unknown as { name: string; breed: string } | null;
              const item = visit.booking_items as unknown as {
                service_versions: {
                  customer_name: string;
                  services: { category: string } | null;
                } | null;
              } | null;
              return (
                <form
                  action={initializeServiceExecution}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-white p-4 shadow-sm"
                  key={visit.id}
                >
                  <input name="petVisitId" type="hidden" value={visit.id} />
                  <div>
                    <p className="font-black">
                      {pet?.name} · {item?.service_versions?.customer_name}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {item?.service_versions?.services?.category}
                    </p>
                  </div>
                  <Button type="submit" variant="secondary">
                    Start
                  </Button>
                </form>
              );
            })}
          </div>
        </Card>
      ) : null}
      {(['boarding', 'daycare', 'grooming'] as const).map((category) => {
        const rows = (executions ?? []).filter(
          (execution) => execution.service_category === category,
        );
        return (
          <Card
            className="overflow-hidden"
            key={category}
            title={`${category[0].toUpperCase()}${category.slice(1)} board`}
            description={`${rows.length} active service${rows.length === 1 ? '' : 's'}`}
          >
            {rows.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((execution) => {
                  const pet = execution.pets as unknown as { name: string; breed: string } | null;
                  const location = execution.locations as unknown as { name: string } | null;
                  const service = execution.service_versions as unknown as {
                    customer_name: string;
                  } | null;
                  const next = transitions[category]?.[execution.stage] ?? [];
                  return (
                    <article
                      className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-canvas)] p-5"
                      key={execution.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {pet?.name} · {service?.customer_name}
                          </p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {pet?.breed} · {location?.name}
                          </p>
                        </div>
                        <Badge
                          tone={
                            execution.stage === 'hold'
                              ? 'danger'
                              : execution.stage === 'ready'
                                ? 'success'
                                : 'info'
                          }
                        >
                          {execution.stage.replaceAll('_', ' ')}
                        </Badge>
                      </div>
                      {next.length ? (
                        <form action={transitionServiceExecution} className="mt-4 grid gap-3">
                          <input name="executionId" type="hidden" value={execution.id} />
                          <label className="text-sm font-bold">
                            Next stage
                            <select className={selectClass} name="nextStage">
                              {next.map((stage) => (
                                <option key={stage} value={stage}>
                                  {stage.replaceAll('_', ' ')}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Field
                            label="Transition notes"
                            name="notes"
                            hint="Required for hold, ready, and completed transitions."
                          />
                          <Button type="submit">Update stage</Button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No active {category} services.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
