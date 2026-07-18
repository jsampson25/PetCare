import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createOperationalIncident, transitionOperationalIncident } from './actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
const nextStates: Record<string, string[]> = {
  open: ['stabilizing', 'monitoring', 'escalated', 'under_review'],
  stabilizing: ['monitoring', 'escalated', 'under_review'],
  monitoring: ['escalated', 'under_review'],
  escalated: ['under_review'],
  under_review: ['action_required', 'resolved'],
  action_required: ['under_review', 'resolved'],
  resolved: ['closed'],
};
export default async function IncidentsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.record_incident')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: visits }, { data: executions }, { data: incidents }] = await Promise.all([
    supabase
      .from('pet_visits')
      .select('id,pet_id,pets(name,breed),operational_visits(locations(name))')
      .eq('business_id', context.businessId)
      .eq('status', 'in_care'),
    supabase
      .from('service_executions')
      .select('id,pet_visit_id,service_category,stage')
      .eq('business_id', context.businessId)
      .neq('stage', 'completed'),
    supabase
      .from('operational_incidents')
      .select(
        'id,pet_visit_id,category,severity,status,occurred_at,initial_facts,immediate_actions,customer_notified,customer_summary,manager_review_required,pets(name),locations(name)',
      )
      .eq('business_id', context.businessId)
      .neq('status', 'closed')
      .order('occurred_at', { ascending: false }),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Safety operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Incidents</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Record verified facts first, keep internal investigation separate, and resolve serious
          events under manager control.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Incident updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Incident action blocked" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <Card
        title="Report incident"
        description="Immediate pet safety takes priority; enter the minimum verified facts promptly."
      >
        <form action={createOperationalIncident} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">
            Pet in care
            <select className={selectClass} name="petVisitId" required>
              <option value="">Select pet</option>
              {visits?.map((visit) => {
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
            Related service
            <select className={selectClass} name="executionId">
              <option value="">Visit-wide / none</option>
              {executions?.map((execution) => {
                const visit = visits?.find((candidate) => candidate.id === execution.pet_visit_id);
                const pet = visit?.pets as unknown as { name: string } | null;
                return (
                  <option key={execution.id} value={execution.id}>
                    {pet?.name} · {execution.service_category} · {execution.stage}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="text-sm font-bold">
            Category
            <select className={selectClass} name="category">
              {[
                'injury',
                'illness',
                'bite_fight',
                'escape',
                'medication',
                'feeding',
                'behavior',
                'facility',
                'customer',
                'other',
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Severity
            <select className={selectClass} name="severity">
              <option value="information">Information</option>
              <option value="minor">Minor</option>
              <option value="serious">Serious</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <Field label="Occurred at" name="occurredAt" type="datetime-local" required />
          <Field label="Verified initial facts" name="initialFacts" required />
          <Field label="Immediate safety actions" name="immediateActions" required />
          <Field label="Internal notes" name="internalNotes" />
          <Field
            label="Customer-safe summary"
            name="customerSummary"
            hint="Do not include internal investigation or unverified conclusions."
          />
          <div className="md:col-span-2">
            <Button type="submit">Report incident</Button>
          </div>
        </form>
      </Card>
      <Card
        title="Open incident queue"
        description="Serious and critical incidents remain escalated until manager-reviewed resolution."
      >
        {incidents?.length ? (
          <div className="grid gap-5">
            {incidents.map((incident) => {
              const pet = incident.pets as unknown as { name: string } | null;
              const location = incident.locations as unknown as { name: string } | null;
              const allowed = nextStates[incident.status] ?? [];
              return (
                <article className="rounded-lg border p-4" key={incident.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">
                        {pet?.name} · {incident.category.replaceAll('_', ' ')}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {location?.name} ·{' '}
                        {new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(incident.occurred_at))}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        tone={
                          incident.severity === 'critical' || incident.severity === 'serious'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {incident.severity}
                      </Badge>
                      <Badge tone="info">{incident.status.replaceAll('_', ' ')}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">
                    <strong>Facts:</strong> {incident.initial_facts}
                  </p>
                  <p className="mt-2 text-sm">
                    <strong>Actions:</strong> {incident.immediate_actions}
                  </p>
                  {incident.customer_notified ? (
                    <p className="mt-2 text-sm">
                      <strong>Customer summary:</strong> {incident.customer_summary}
                    </p>
                  ) : null}
                  {allowed.length ? (
                    <form
                      action={transitionOperationalIncident}
                      className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2"
                    >
                      <input name="incidentId" type="hidden" value={incident.id} />
                      <label className="text-sm font-bold">
                        Next status
                        <select className={selectClass} name="nextStatus">
                          {allowed.map((state) => (
                            <option key={state} value={state}>
                              {state.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Field label="Response notes" name="notes" required />
                      <label className="flex gap-3 text-sm font-bold">
                        <input name="customerNotified" type="checkbox" value="yes" />
                        Customer notified in this step
                      </label>
                      <Field label="Approved customer summary" name="customerSummary" />
                      <div className="md:col-span-2">
                        <Button type="submit" variant="secondary">
                          Update incident
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No open incidents.</p>
        )}
      </Card>
    </div>
  );
}
