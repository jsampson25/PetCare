import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  correctCareTaskOutcome,
  recordCareTaskOutcome,
  scheduleCareTask,
  transitionOperationalAlert,
} from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
const terminal = [
  'completed',
  'partial',
  'refused',
  'held',
  'missed',
  'unable',
  'adverse',
  'cancelled',
];
export default async function TasksPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (
    !context ||
    (!context.permissions.has('operations.record_feeding') &&
      !context.permissions.has('operations.record_medication'))
  )
    redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const [{ data: tasks }, { data: petVisits }, { data: alerts }] = await Promise.all([
    supabase
      .from('care_tasks')
      .select(
        'id,task_type,title,instructions,due_starts_at,due_ends_at,priority,status,pets(name,breed),locations(name)',
      )
      .eq('business_id', context.businessId)
      .order('due_starts_at')
      .limit(150),
    supabase
      .from('pet_visits')
      .select(
        'id,pet_id,status,handoff_status,pets(name,breed),operational_visits(scheduled_start,scheduled_end,locations(name))',
      )
      .eq('business_id', context.businessId)
      .eq('status', 'in_care')
      .eq('handoff_status', 'accepted'),
    supabase
      .from('operational_alerts')
      .select(
        'id,severity,status,summary,details,created_at,care_tasks(title),pet_visits(pets(name))',
      )
      .eq('business_id', context.businessId)
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false }),
  ]);
  const openTasks = (tasks ?? []).filter((task) => !terminal.includes(task.status));
  const dueTasks = openTasks.filter((task) => new Date(task.due_starts_at) <= now);
  const overdueTasks = openTasks.filter((task) => new Date(task.due_ends_at) < now);
  const terminalTasks = (tasks ?? [])
    .filter((task) => terminal.includes(task.status))
    .slice(-20)
    .reverse();
  const canCorrect = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Daily operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Care work</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Medication and feeding remain pet-specific, snapshot-bound, and auditable.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Work updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Work unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {alerts?.length ? (
        <Alert title={`${alerts.length} open care alert(s)`} tone="danger">
          Exceptions remain visible until the follow-up workflow resolves them.
        </Alert>
      ) : null}
      {alerts?.length ? (
        <Card
          title="Alert queue"
          description="Acknowledgement assigns follow-up; resolution requires evidence."
        >
          <div className="grid gap-4">
            {alerts.map((alert) => {
              const petVisit = alert.pet_visits as unknown as {
                pets: { name: string } | null;
              } | null;
              return (
                <article className="rounded-lg border p-4" key={alert.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black">
                      {petVisit?.pets?.name ?? 'Pet'} · {alert.summary}
                    </p>
                    <Badge
                      tone={
                        alert.severity === 'critical' || alert.severity === 'urgent'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {alert.status} · {alert.severity}
                    </Badge>
                  </div>
                  <form
                    action={transitionOperationalAlert}
                    className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]"
                  >
                    <input name="alertId" type="hidden" value={alert.id} />
                    <Field label="Resolution notes" name="resolutionNotes" />
                    {alert.status === 'open' ? (
                      <Button
                        name="alertStatus"
                        type="submit"
                        value="acknowledged"
                        variant="secondary"
                      >
                        Acknowledge
                      </Button>
                    ) : null}
                    <Button name="alertStatus" type="submit" value="resolved">
                      Resolve
                    </Button>
                  </form>
                </article>
              );
            })}
          </div>
        </Card>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-3xl font-black">{openTasks.length}</p>
          <p className="text-sm text-[var(--text-secondary)]">Open tasks</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{dueTasks.length}</p>
          <p className="text-sm text-[var(--text-secondary)]">Due now</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{overdueTasks.length}</p>
          <p className="text-sm text-[var(--text-secondary)]">Overdue</p>
        </Card>
      </section>
      <Card
        title="Schedule snapshot-backed work"
        description="Use an explicit due window. Never infer medication timing from free-text instructions."
      >
        <form action={scheduleCareTask} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">
            Pet in care
            <select className={selectClass} name="petVisitId" required>
              <option value="">Select pet</option>
              {petVisits?.map((visit) => {
                const pet = visit.pets as unknown as { name: string; breed: string } | null;
                return (
                  <option key={visit.id} value={visit.id}>
                    {pet?.name} · {pet?.breed}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="text-sm font-bold">
            Task type
            <select className={selectClass} name="taskType" required>
              {context.permissions.has('operations.record_feeding') ? (
                <option value="feeding">Feeding</option>
              ) : null}
              {context.permissions.has('operations.record_medication') ? (
                <option value="medication">Medication</option>
              ) : null}
            </select>
          </label>
          <Field label="Task title" name="title" required />
          <Field label="Exact instructions" name="instructions" required />
          <Field label="Due window starts" name="dueStartsAt" type="datetime-local" required />
          <Field label="Due window ends" name="dueEndsAt" type="datetime-local" required />
          <label className="text-sm font-bold">
            Priority
            <select className={selectClass} name="priority">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <Button type="submit">Schedule care task</Button>
          </div>
        </form>
      </Card>
      <Card
        title="Work queue"
        description="Overdue work stays visible; medication cannot be bulk-completed."
      >
        {openTasks.length ? (
          <div className="grid gap-5">
            {openTasks.map((task) => {
              const pet = task.pets as unknown as { name: string; breed: string } | null;
              const location = task.locations as unknown as { name: string } | null;
              const overdue = new Date(task.due_ends_at) < now;
              const instructions = task.instructions as { instructions?: string };
              return (
                <article className="rounded-lg border p-4" key={task.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">
                        {pet?.name} · {task.title}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {location?.name} · {task.task_type} ·{' '}
                        {new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(task.due_starts_at))}
                      </p>
                    </div>
                    <Badge
                      tone={overdue ? 'danger' : task.priority === 'critical' ? 'warning' : 'info'}
                    >
                      {overdue ? 'overdue' : task.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm">{instructions.instructions}</p>
                  <form
                    action={recordCareTaskOutcome}
                    className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2"
                  >
                    <input name="taskId" type="hidden" value={task.id} />
                    <input name="taskType" type="hidden" value={task.task_type} />
                    <label className="text-sm font-bold">
                      Outcome
                      <select className={selectClass} name="outcome">
                        <option value="completed">
                          {task.task_type === 'medication'
                            ? 'Administered as ordered'
                            : 'Meal completed'}
                        </option>
                        <option value="partial">Partial</option>
                        <option value="refused">Refused</option>
                        {task.task_type === 'medication' ? (
                          <>
                            <option value="held">Held under instruction</option>
                            <option value="missed">Missed</option>
                            <option value="adverse">Adverse / uncertain</option>
                          </>
                        ) : null}
                        <option value="unable">Unable</option>
                      </select>
                    </label>
                    <Field label="Structured observation" name="details" required />
                    <Field
                      label="Exception reason"
                      name="reason"
                      hint="Required for every outcome except completed."
                    />
                    <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold">
                      <input name="petIdentityConfirmed" type="checkbox" value="yes" required />I
                      verified the correct pet.
                    </label>
                    {task.task_type === 'medication' ? (
                      <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold md:col-span-2">
                        <input name="fiveRightsConfirmed" type="checkbox" value="yes" required />I
                        verified pet, medication, dose, route, and scheduled time.
                      </label>
                    ) : null}
                    <div className="md:col-span-2">
                      <Button type="submit">Record {task.task_type} outcome</Button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No open care tasks.</p>
        )}
      </Card>
      {canCorrect && terminalTasks.length ? (
        <Card
          title="Recent outcomes and corrections"
          description="Corrections append evidence; the original recorded outcome remains in history."
        >
          <div className="grid gap-4">
            {terminalTasks.map((task) => {
              const pet = task.pets as unknown as { name: string } | null;
              return (
                <article className="rounded-lg border p-4" key={`correction-${task.id}`}>
                  <p className="font-black">
                    {pet?.name} · {task.title}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Recorded outcome: {task.status}
                  </p>
                  <form action={correctCareTaskOutcome} className="mt-4 grid gap-4 md:grid-cols-2">
                    <input name="taskId" type="hidden" value={task.id} />
                    <input name="taskType" type="hidden" value={task.task_type} />
                    <label className="text-sm font-bold">
                      Corrected outcome
                      <select className={selectClass} name="correctedStatus">
                        <option value="completed">Completed</option>
                        <option value="partial">Partial</option>
                        <option value="refused">Refused</option>
                        {task.task_type === 'medication' ? (
                          <>
                            <option value="held">Held</option>
                            <option value="missed">Missed</option>
                            <option value="adverse">Adverse / uncertain</option>
                          </>
                        ) : null}
                        <option value="unable">Unable</option>
                      </select>
                    </label>
                    <Field label="Corrected observation" name="correctedDetails" required />
                    <Field label="Correction reason" name="reason" required />
                    {task.task_type === 'medication' ? (
                      <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold">
                        <input name="fiveRightsConfirmed" type="checkbox" value="yes" />
                        Five rights confirmed for a completed correction.
                      </label>
                    ) : null}
                    <div className="md:col-span-2">
                      <Button type="submit" variant="secondary">
                        Append correction
                      </Button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
