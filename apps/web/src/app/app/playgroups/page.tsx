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
import {
  addPlaygroupParticipant,
  clearPlaygroupRemoval,
  createPlaygroupSession,
  recordDaycareEvaluation,
  transitionPlaygroupParticipant,
} from './actions';
import { filterPlaygroupSessions, summarizePlaygroupBoard } from './playgroup-board-view';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';

export default async function PlaygroupsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_playgroup')) redirect('/denied');
  const parameters = await searchParams;
  const sizeParameter = typeof parameters.size === 'string' ? parameters.size : 'all';
  const requestedSize = ['all', 'small', 'medium', 'large', 'mixed', 'special_needs'].includes(
    sizeParameter,
  )
    ? sizeParameter
    : 'all';
  const viewParameter = typeof parameters.view === 'string' ? parameters.view : 'all';
  const requestedView = ['all', 'available', 'full', 'attention'].includes(viewParameter)
    ? viewParameter
    : 'all';
  const supabase = await createSupabaseServerClient();
  const [
    { data: executions },
    { data: sessions },
    { data: participants },
    { data: evaluations },
    { data: locations },
  ] = await Promise.all([
    supabase
      .from('service_executions')
      .select('id,stage,pet_id,pets(name,breed),locations(name)')
      .eq('business_id', context.businessId)
      .eq('service_category', 'daycare')
      .not('stage', 'in', '(completed,ready)'),
    supabase
      .from('playgroup_sessions')
      .select('id,label,size_band,max_pets,pets_per_staff,staff_count,location_id,locations(name)')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('started_at'),
    supabase
      .from('playgroup_participants')
      .select(
        'id,status,playgroup_session_id,service_execution_id,removal_category,removal_reason,cleared_at,pets(name,breed)',
      )
      .eq('business_id', context.businessId)
      .in('status', ['active', 'resting', 'removed']),
    supabase
      .from('daycare_evaluations')
      .select('service_execution_id,outcome,restrictions,evaluated_at')
      .eq('business_id', context.businessId)
      .order('evaluated_at', { ascending: false }),
    supabase
      .from('locations')
      .select('id,name')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('name'),
  ]);
  const latestEvaluation = new Map<
    string,
    typeof evaluations extends (infer T)[] | null ? T : never
  >();
  for (const evaluation of evaluations ?? [])
    if (!latestEvaluation.has(evaluation.service_execution_id))
      latestEvaluation.set(evaluation.service_execution_id, evaluation);
  const placedIds = new Set(
    (participants ?? []).map((participant) => participant.service_execution_id),
  );
  const eligible = (executions ?? []).filter(
    (execution) =>
      execution.stage === 'playgroup' &&
      !placedIds.has(execution.id) &&
      ['approved', 'restricted'].includes(latestEvaluation.get(execution.id)?.outcome ?? ''),
  );
  const sessionRows = (sessions ?? []).map((session) => {
    const members = (participants ?? []).filter(
      (participant) => participant.playgroup_session_id === session.id,
    );
    return {
      session,
      members,
      size_band: session.size_band,
      effective_capacity: Math.min(session.max_pets, session.pets_per_staff * session.staff_count),
      active_count: members.filter((member) => member.status === 'active').length,
      resting_count: members.filter((member) => member.status === 'resting').length,
      removed_count: members.filter((member) => member.status === 'removed').length,
    };
  });
  const visibleSessions = filterPlaygroupSessions(sessionRows, requestedSize, requestedView);
  const summary = summarizePlaygroupBoard(sessionRows, eligible.length);
  const canClear = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/service-board?category=daycare"
            leadingIcon={<Icon name="clipboard" />}
            variant="secondary"
          >
            Daycare board
          </ButtonLink>
        }
        description="Evaluation, staffed capacity, rest, and safety removals remain explicit."
        eyebrow="Daycare operations"
        title="Playgroups"
      />
      {typeof parameters.notice === 'string' ? (
        <Alert title="Playgroup updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Safety check blocked the action" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <CommandBar
        description="Focus staffed sessions by care band, remaining capacity, or safety attention."
        title="Filter playgroup sessions"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField
            defaultValue={requestedSize}
            density="compact"
            label="Size / care band"
            name="size"
          >
            <option value="all">All care bands</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="mixed">Mixed</option>
            <option value="special_needs">Special needs</option>
          </SelectField>
          <SelectField
            defaultValue={requestedView}
            density="compact"
            label="Session view"
            name="view"
          >
            <option value="all">All active sessions</option>
            <option value="available">Capacity available</option>
            <option value="full">At staffed capacity</option>
            <option value="attention">Safety attention</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Live summary" title="Playgroup workload" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryMetric label="Active sessions" value={summary.sessions} />
          <SummaryMetric label="Playing" value={summary.active} />
          <SummaryMetric label="Resting" value={summary.resting} />
          <SummaryMetric label="Removed" value={summary.removed} />
          <SummaryMetric label="Eligible to place" value={summary.eligible} />
        </dl>
      </Card>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Record daycare evaluation"
          description="Restrictions are snapshotted when a pet joins a group."
        >
          <form action={recordDaycareEvaluation} className="grid gap-4">
            <label className="text-sm font-bold">
              Daycare pet
              <select className={selectClass} name="executionId" required>
                <option value="">Select pet</option>
                {executions?.map((execution) => {
                  const pet = execution.pets as unknown as { name: string; breed: string } | null;
                  return (
                    <option key={execution.id} value={execution.id}>
                      {pet?.name} · {pet?.breed} · {execution.stage}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-sm font-bold">
              Decision
              <select className={selectClass} name="outcome">
                <option value="approved">Approved</option>
                <option value="restricted">Approved with restrictions</option>
                <option value="not_approved">Not approved</option>
              </select>
            </label>
            <Field
              label="Restrictions"
              name="restrictions"
              hint="Required when approving with restrictions."
            />
            <Field label="Evaluation facts" name="notes" required />
            <Button type="submit">Record evaluation</Button>
          </form>
        </Card>
        <Card
          title="Open staffed session"
          description="Effective capacity is the lower of physical capacity and staffed ratio."
        >
          <form action={createPlaygroupSession} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">
              Location
              <select className={selectClass} name="locationId" required>
                {locations?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Group label" name="label" required />
            <label className="text-sm font-bold">
              Size / care band
              <select className={selectClass} name="sizeBand">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="mixed">Mixed</option>
                <option value="special_needs">Special needs</option>
              </select>
            </label>
            <Field label="Physical maximum" name="maxPets" type="number" required />
            <Field label="Pets per staff" name="petsPerStaff" type="number" required />
            <Field label="Staff present" name="staffCount" type="number" required />
            <div className="md:col-span-2">
              <Button type="submit">Open playgroup</Button>
            </div>
          </form>
        </Card>
      </section>
      {visibleSessions.map(({ session, members, effective_capacity: effective }) => {
        const location = session.locations as unknown as { name: string } | null;
        return (
          <Card
            key={session.id}
            title={session.label}
            description={`${location?.name} · ${members.filter((member) => member.status === 'active').length}/${effective} active capacity · ${session.staff_count} staff`}
          >
            <div className="mb-5">
              <Badge tone="info">{session.size_band.replaceAll('_', ' ')}</Badge>
            </div>
            {eligible.length ? (
              <form
                action={addPlaygroupParticipant}
                className="mb-5 grid gap-3 border-b pb-5 md:grid-cols-[1fr_auto]"
              >
                <input name="sessionId" type="hidden" value={session.id} />
                <label className="text-sm font-bold">
                  Add evaluated pet
                  <select className={selectClass} name="executionId">
                    {eligible.map((execution) => {
                      const pet = execution.pets as unknown as { name: string } | null;
                      return (
                        <option key={execution.id} value={execution.id}>
                          {pet?.name} · {latestEvaluation.get(execution.id)?.outcome}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <Button type="submit">Add to group</Button>
              </form>
            ) : null}
            <div className="grid gap-4">
              {members.length ? (
                members.map((participant) => {
                  const pet = participant.pets as unknown as { name: string; breed: string } | null;
                  return (
                    <article className="rounded-lg border p-4" key={participant.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-black">
                          {pet?.name} · {pet?.breed}
                        </p>
                        <Badge
                          tone={
                            participant.status === 'removed'
                              ? 'danger'
                              : participant.status === 'resting'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {participant.status}
                        </Badge>
                      </div>
                      {participant.removal_reason ? (
                        <p className="mt-2 text-sm">
                          {participant.removal_category}: {participant.removal_reason}
                        </p>
                      ) : null}
                      {participant.status === 'removed' && canClear && !participant.cleared_at ? (
                        <form
                          action={clearPlaygroupRemoval}
                          className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
                        >
                          <input name="participantId" type="hidden" value={participant.id} />
                          <Field label="Manager clearance" name="clearanceNotes" required />
                          <Button type="submit" variant="secondary">
                            Clear review
                          </Button>
                        </form>
                      ) : (
                        <form
                          action={transitionPlaygroupParticipant}
                          className="mt-4 grid gap-3 md:grid-cols-2"
                        >
                          <input name="participantId" type="hidden" value={participant.id} />
                          <label className="text-sm font-bold">
                            Next status
                            <select className={selectClass} name="nextStatus">
                              {participant.status === 'removed' ? (
                                <option value="active">Return after clearance</option>
                              ) : (
                                <>
                                  <option value="resting">Rest</option>
                                  {participant.status === 'resting' ? (
                                    <option value="active">Return to group</option>
                                  ) : null}
                                  <option value="removed">Remove for safety/review</option>
                                  <option value="completed">Complete session</option>
                                </>
                              )}
                            </select>
                          </label>
                          <label className="text-sm font-bold">
                            Removal category
                            <select className={selectClass} name="removalCategory">
                              <option value="safety">Safety</option>
                              <option value="behavior">Behavior</option>
                              <option value="wellness">Wellness</option>
                              <option value="other">Other</option>
                            </select>
                          </label>
                          <Field
                            label="Transition notes"
                            name="notes"
                            hint="Required for removal."
                          />
                          <div className="self-end">
                            <Button type="submit" variant="secondary">
                              Update participant
                            </Button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">No pets assigned.</p>
              )}
            </div>
          </Card>
        );
      })}
      {!visibleSessions.length ? (
        <StatePanel
          description={
            sessions?.length
              ? 'No active playgroups match the selected care band and session view.'
              : 'Open a staffed session to begin placing evaluated daycare pets.'
          }
          title={sessions?.length ? 'No matching playgroups' : 'No active playgroups'}
        />
      ) : null}
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
