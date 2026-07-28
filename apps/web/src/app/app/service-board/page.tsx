import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Field } from '@petcare/ui/field';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { initializeServiceExecution, transitionServiceExecution } from './actions';
import { filterServiceExecutions, summarizeServiceBoard } from './service-board-view';

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
  const categoryParameter = typeof parameters.category === 'string' ? parameters.category : 'all';
  const requestedCategory = ['all', 'boarding', 'daycare', 'grooming'].includes(categoryParameter)
    ? categoryParameter
    : 'all';
  const stageParameter = typeof parameters.stage === 'string' ? parameters.stage : 'all';
  const requestedStage = ['all', 'in_progress', 'hold', 'ready'].includes(stageParameter)
    ? stageParameter
    : 'all';
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
    const category = item?.service_versions?.services?.category ?? '';
    return (
      !activePetIds.has(visit.id) &&
      ['boarding', 'daycare', 'grooming'].includes(category) &&
      (requestedCategory === 'all' || requestedCategory === category)
    );
  });
  const visibleExecutions = filterServiceExecutions(
    executions ?? [],
    requestedCategory,
    requestedStage,
  );
  const categoryExecutions = filterServiceExecutions(executions ?? [], requestedCategory, 'all');
  const summary = summarizeServiceBoard(categoryExecutions, unstarted.length);
  const visibleCategories =
    requestedCategory === 'all'
      ? (['boarding', 'daycare', 'grooming'] as const)
      : ([requestedCategory] as const);
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink href="/app/tasks" leadingIcon={<Icon name="clipboard" />}>
            Open care work
          </ButtonLink>
        }
        description="Boarding, daycare, and grooming retain distinct stages on one operational command surface."
        eyebrow="Daily operations"
        title="Service boards"
      />
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
      <CommandBar
        description="Focus the board by service line or the work state that needs attention."
        title="Filter service work"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField
            defaultValue={requestedCategory}
            density="compact"
            label="Service category"
            name="category"
          >
            <option value="all">All services</option>
            <option value="boarding">Boarding</option>
            <option value="daycare">Daycare</option>
            <option value="grooming">Grooming</option>
          </SelectField>
          <SelectField
            defaultValue={requestedStage}
            density="compact"
            label="Work state"
            name="stage"
          >
            <option value="all">All active work</option>
            <option value="in_progress">In progress</option>
            <option value="hold">On hold</option>
            <option value="ready">Ready</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Board summary" title="Operational workload" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Active services" value={summary.active} />
          <SummaryMetric label="Ready to start" value={summary.unstarted} />
          <SummaryMetric label="On hold" value={summary.onHold} />
          <SummaryMetric label="Ready" value={summary.ready} />
        </dl>
      </Card>
      {unstarted.length ? (
        <Card
          className="border-blue-100 bg-[linear-gradient(135deg,#f2f7ff,#fff)]"
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
      {visibleCategories.map((category) => {
        const rows = visibleExecutions.filter(
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
              <StatePanel
                description="Adjust the filters or initialize an eligible visit when custody handoff is complete."
                size="compact"
                title={`No ${category} services in this view`}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-1 text-3xl font-black tracking-tight">{value}</dd>
    </div>
  );
}
