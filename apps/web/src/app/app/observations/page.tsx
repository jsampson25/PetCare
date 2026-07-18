import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { recordVisitObservation } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.record_observation')) redirect('/denied');
  const parameters = await searchParams;
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
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Daily operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Care log</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Record what staff observed without turning observations into diagnoses.
        </p>
      </header>
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
      <Card
        title="Record observation"
        description="Urgent and critical concerns automatically enter the operational alert queue."
      >
        <form action={recordVisitObservation} className="grid gap-4 md:grid-cols-2">
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
            Category
            <select className={selectClass} name="category">
              <option value="activity">Activity / enrichment</option>
              <option value="elimination">Potty / elimination</option>
              <option value="rest">Rest</option>
              <option value="wellness">Wellness</option>
            </select>
          </label>
          <Field
            label="Observation type"
            name="observationType"
            placeholder="Yard play, stool, nap, mobility…"
            required
          />
          <Field label="Observed at" name="observedAt" type="datetime-local" required />
          <Field label="Structured details" name="details" required />
          <label className="text-sm font-bold">
            Concern level
            <select className={selectClass} name="concernLevel">
              <option value="information">Information</option>
              <option value="warning">Warning</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </label>
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
        {observations?.length ? (
          <div className="divide-y">
            {observations.map((observation) => {
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
          <p className="text-sm text-[var(--text-secondary)]">No care observations recorded.</p>
        )}
      </Card>
    </div>
  );
}
