import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
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

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';

export default async function PlaygroupsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_playgroup')) redirect('/denied');
  const parameters = await searchParams;
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
  const canClear = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Daycare operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Playgroups</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Evaluation, staffed capacity, rest, and safety removals remain explicit.
        </p>
      </header>
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
      {sessions?.map((session) => {
        const location = session.locations as unknown as { name: string } | null;
        const members = (participants ?? []).filter(
          (participant) => participant.playgroup_session_id === session.id,
        );
        const effective = Math.min(session.max_pets, session.pets_per_staff * session.staff_count);
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
    </div>
  );
}
