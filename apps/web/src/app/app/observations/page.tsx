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
import { recordVisitObservation } from './actions';
import { filterCareObservations, summarizeCareObservations } from './care-log-view';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.record_observation')) redirect('/denied');
  const parameters = await searchParams;
  const categoryParameter = typeof parameters.category === 'string' ? parameters.category : 'all';
  const requestedCategory = ['all', 'activity', 'elimination', 'rest', 'wellness'].includes(
    categoryParameter,
  )
    ? categoryParameter
    : 'all';
  const concernParameter = typeof parameters.concern === 'string' ? parameters.concern : 'all';
  const requestedConcern = ['all', 'attention', 'urgent', 'information'].includes(concernParameter)
    ? (concernParameter as 'all' | 'attention' | 'urgent' | 'information')
    : 'all';
  const supabase = await createSupabaseServerClient();
  const [{ data: visits }, { data: observations }] = await Promise.all([
    supabase
      .from('pet_visits')
      .select('id,pets(name,breed),operational_visits(locations(name))')
      .eq('business_id', context.businessId)
      .eq('status', 'in_care')
      .eq('handoff_status', 'accepted'),
    supabase
      .from('visit_observations')
      .select(
        'id,category,observation_type,details,concern_level,customer_visible,observed_at,pets(name),locations(name)',
      )
      .eq('business_id', context.businessId)
      .order('observed_at', { ascending: false })
      .limit(100),
  ]);
  const visibleObservations = filterCareObservations(
    observations ?? [],
    requestedCategory,
    requestedConcern,
  );
  const summary = summarizeCareObservations(observations ?? []);
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/incidents"
            leadingIcon={<Icon name="shield" />}
            variant="secondary"
          >
            Incident response
          </ButtonLink>
        }
        description="Record what staff observed without turning observations into diagnoses."
        eyebrow="Daily operations"
        title="Care log"
      />
      {typeof parameters.notice === 'string' ? (
        <Alert title="Care log updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Observation unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <CommandBar
        description="Review routine care separately from observations that need follow-up or escalation."
        title="Filter recent observations"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField
            defaultValue={requestedCategory}
            density="compact"
            label="Care category"
            name="category"
          >
            <option value="all">All categories</option>
            <option value="activity">Activity / enrichment</option>
            <option value="elimination">Potty / elimination</option>
            <option value="rest">Rest</option>
            <option value="wellness">Wellness</option>
          </SelectField>
          <SelectField
            defaultValue={requestedConcern}
            density="compact"
            label="Concern level"
            name="concern"
          >
            <option value="all">All observations</option>
            <option value="attention">Needs attention</option>
            <option value="urgent">Urgent or critical</option>
            <option value="information">Information only</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Recent log summary" title="Care observations" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Recorded" value={summary.recorded} />
          <SummaryMetric label="Needs attention" value={summary.attention} />
          <SummaryMetric label="Urgent or critical" value={summary.urgent} />
          <SummaryMetric label="Customer visible" value={summary.customerVisible} />
        </dl>
      </Card>
      <Card
        title="Record observation"
        description="Urgent and critical concerns automatically enter the operational alert queue."
      >
        <form action={recordVisitObservation} className="grid gap-4 md:grid-cols-2">
          <SelectField label="Pet in care" name="petVisitId" required>
            <option value="">Select pet</option>
            {visits?.map((visit) => {
              const pet = visit.pets as unknown as { name: string; breed: string } | null;
              return (
                <option key={visit.id} value={visit.id}>
                  {pet?.name} · {pet?.breed}
                </option>
              );
            })}
          </SelectField>
          <SelectField label="Category" name="category">
            <option value="activity">Activity / enrichment</option>
            <option value="elimination">Potty / elimination</option>
            <option value="rest">Rest</option>
            <option value="wellness">Wellness</option>
          </SelectField>
          <Field
            label="Observation type"
            name="observationType"
            placeholder="Yard play, stool, nap, mobility…"
            required
          />
          <Field label="Observed at" name="observedAt" type="datetime-local" required />
          <Field label="Structured details" name="details" required />
          <SelectField label="Concern level" name="concernLevel">
            <option value="information">Information</option>
            <option value="warning">Warning</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </SelectField>
          <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold md:col-span-2">
            <input name="customerVisible" type="checkbox" value="yes" />
            Approved for customer timeline visibility.
          </label>
          <div className="md:col-span-2">
            <Button type="submit">Record observation</Button>
          </div>
        </form>
      </Card>
      <Card
        title="Recent observations"
        description="Operational history is append-only and ordered by the actual observation time."
      >
        {visibleObservations.length ? (
          <div className="divide-y">
            {visibleObservations.map((observation) => {
              const pet = observation.pets as unknown as { name: string } | null;
              const details = observation.details as { observation?: string };
              return (
                <div className="py-4" key={observation.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black">
                      {pet?.name} · {observation.observation_type}
                    </p>
                    <Badge
                      tone={
                        observation.concern_level === 'critical' ||
                        observation.concern_level === 'urgent'
                          ? 'danger'
                          : observation.concern_level === 'warning'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {observation.concern_level}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{details.observation}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {observation.category} ·{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(observation.observed_at))}
                    {observation.customer_visible ? ' · customer visible' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <StatePanel
            description={
              observations?.length
                ? 'No recent observations match the selected care category and concern level.'
                : 'New care observations will appear here in the order they were actually observed.'
            }
            size="compact"
            title={observations?.length ? 'No matching observations' : 'No observations recorded'}
          />
        )}
      </Card>
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
