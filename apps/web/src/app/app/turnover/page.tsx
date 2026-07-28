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
import { completeCleaning, inspectTurnover, startTurnover } from './actions';
import { filterTurnoverTasks, summarizeTurnoverTasks } from './turnover-view';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const checklistClass = 'flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-bold';

function Checklist({ names }: { names: Array<[string, string]> }) {
  return names.map(([name, label]) => (
    <label className={checklistClass} key={name}>
      <input name={name} type="checkbox" value="yes" />
      {label}
    </label>
  ));
}

export default async function TurnoverPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  const canClean = context?.permissions.has('operations.clean_resources');
  const canInspect = context?.permissions.has('operations.inspect_resources');
  if (!context || (!canClean && !canInspect)) redirect('/denied');
  const parameters = await searchParams;
  const statusParameter = typeof parameters.status === 'string' ? parameters.status : 'all';
  const requestedStatus = ['all', 'cleaning_required', 'cleaning', 'inspection_required'].includes(
    statusParameter,
  )
    ? statusParameter
    : 'all';
  const supabase = await createSupabaseServerClient();
  const { data: tasks } = await supabase
    .from('resource_turnover_tasks')
    .select(
      'id,status,created_at,cleaning_started_at,cleaning_completed_at,protocol_reference,cleaning_notes,inspection_notes,failure_reason,locations(name),capacity_resources(resource_code,label,resource_type)',
    )
    .eq('business_id', context.businessId)
    .neq('status', 'ready')
    .order('created_at');
  const visibleTasks = filterTurnoverTasks(tasks ?? [], requestedStatus);
  const summary = summarizeTurnoverTasks(tasks ?? []);
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/availability"
            leadingIcon={<Icon name="calendar" />}
            variant="secondary"
          >
            View availability
          </ButtonLink>
        }
        description="Released resources stay unavailable until cleaning is documented and inspection passes."
        eyebrow="Facility readiness"
        title="Cleaning & turnover"
      />
      {typeof parameters.notice === 'string' ? (
        <Alert title="Turnover updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Turnover unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <CommandBar
        description="Focus cleaners and inspectors on the workflow stage that needs attention."
        title="Filter turnover work"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField
            defaultValue={requestedStatus}
            density="compact"
            label="Workflow stage"
            name="status"
          >
            <option value="all">All turnover work</option>
            <option value="cleaning_required">Waiting for cleaning</option>
            <option value="cleaning">Cleaning in progress</option>
            <option value="inspection_required">Waiting for inspection</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filter
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Readiness summary" title="Facility workload" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Waiting for cleaning" value={summary.waiting} />
          <SummaryMetric label="Cleaning now" value={summary.cleaning} />
          <SummaryMetric label="Awaiting inspection" value={summary.inspection} />
          <SummaryMetric label="Failed inspection" value={summary.failed} />
        </dl>
      </Card>
      {visibleTasks.length ? (
        <div className="grid gap-6">
          {visibleTasks.map((task) => {
            const location = task.locations as unknown as { name: string } | null;
            const resource = task.capacity_resources as unknown as {
              resource_code: string;
              label: string;
              resource_type: string;
            } | null;
            return (
              <Card
                description={`${location?.name ?? 'Location'} · ${resource?.resource_code ?? 'Resource'} · ${resource?.resource_type ?? ''}`}
                key={task.id}
                title={resource?.label ?? 'Resource turnover'}
              >
                <div className="mb-5 flex flex-wrap gap-2">
                  <Badge tone={task.status === 'inspection_required' ? 'warning' : 'danger'}>
                    {task.status.replaceAll('_', ' ')}
                  </Badge>
                  {task.failure_reason ? <Badge tone="danger">inspection failed</Badge> : null}
                </div>
                {task.status === 'cleaning_required' && canClean ? (
                  <form action={startTurnover}>
                    <input name="taskId" type="hidden" value={task.id} />
                    <Button type="submit">Start cleaning</Button>
                  </form>
                ) : null}
                {task.status === 'cleaning' && canClean ? (
                  <form action={completeCleaning} className="grid gap-3 md:grid-cols-2">
                    <input name="taskId" type="hidden" value={task.id} />
                    <Checklist
                      names={[
                        ['debris_removed', 'Debris and used materials removed'],
                        ['washed', 'Surfaces washed'],
                        ['disinfected', 'Approved disinfectant applied'],
                        ['dry', 'Resource is fully dry'],
                        ['setup_reset', 'Bedding and setup reset'],
                      ]}
                    />
                    <Field label="Protocol or product reference" name="protocol" required />
                    <Field label="Cleaning notes" name="notes" />
                    <div className="md:col-span-2">
                      <Button type="submit">Complete cleaning</Button>
                    </div>
                  </form>
                ) : null}
                {task.status === 'inspection_required' && canInspect ? (
                  <form action={inspectTurnover} className="grid gap-3 md:grid-cols-2">
                    <input name="taskId" type="hidden" value={task.id} />
                    <Checklist
                      names={[
                        ['visibly_clean', 'Visibly clean'],
                        ['dry', 'Dry and ready for use'],
                        ['odor_free', 'No concerning odor'],
                        ['safe', 'No safety or maintenance concern'],
                        ['setup_correct', 'Setup matches facility standard'],
                      ]}
                    />
                    <label className="text-sm font-bold">
                      Result
                      <select
                        className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
                        name="result"
                      >
                        <option value="passed">Pass and release</option>
                        <option value="failed">Fail and require recleaning</option>
                      </select>
                    </label>
                    <Field label="Inspection evidence and notes" name="notes" required />
                    <div className="md:col-span-2">
                      <Button type="submit">Record inspection</Button>
                    </div>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <StatePanel
          description={
            tasks?.length
              ? 'No turnover tasks match the selected workflow stage.'
              : 'Released resources will appear here until cleaning and inspection are complete.'
          }
          title={tasks?.length ? 'No matching turnover work' : 'All resources are ready'}
        />
      )}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm font-bold text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-1 text-3xl font-black tracking-tight text-[var(--text-primary)]">
        {value}
      </dd>
    </div>
  );
}
