import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  recordGroomingAuthorization,
  recordGroomingIntake,
  recordGroomingQualityReview,
} from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
export default async function GroomingPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_grooming')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: executions }, { data: intakes }, { data: authorizations }, { data: reviews }] =
    await Promise.all([
      supabase
        .from('service_executions')
        .select('id,stage,pets(name,breed),service_versions(customer_name),locations(name)')
        .eq('business_id', context.businessId)
        .eq('service_category', 'grooming')
        .neq('stage', 'completed')
        .order('updated_at'),
      supabase
        .from('grooming_intake_assessments')
        .select(
          'id,service_execution_id,matting_severity,material_change_required,price_change_required,approval_status,additional_work,assessed_at',
        )
        .eq('business_id', context.businessId)
        .order('assessed_at', { ascending: false }),
      supabase
        .from('grooming_change_authorizations')
        .select('grooming_intake_id,decision,recorded_at')
        .eq('business_id', context.businessId)
        .order('recorded_at', { ascending: false }),
      supabase
        .from('grooming_quality_reviews')
        .select('service_execution_id,outcome,reviewed_at')
        .eq('business_id', context.businessId)
        .order('reviewed_at', { ascending: false }),
    ]);
  const latestIntake = new Map<string, typeof intakes extends (infer T)[] | null ? T : never>();
  for (const intake of intakes ?? [])
    if (!latestIntake.has(intake.service_execution_id))
      latestIntake.set(intake.service_execution_id, intake);
  const latestAuthorization = new Map<string, string>();
  for (const authorization of authorizations ?? [])
    if (!latestAuthorization.has(authorization.grooming_intake_id))
      latestAuthorization.set(authorization.grooming_intake_id, authorization.decision);
  const latestReview = new Map<string, string>();
  for (const review of reviews ?? [])
    if (!latestReview.has(review.service_execution_id))
      latestReview.set(review.service_execution_id, review.outcome);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Grooming operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Grooming intake & quality</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Changed scope requires authority; ready status requires a passed quality review.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Grooming updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Grooming action blocked" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {executions?.length ? (
        <div className="grid gap-5">
          {executions.map((execution) => {
            const pet = execution.pets as unknown as { name: string; breed: string } | null;
            const service = execution.service_versions as unknown as {
              customer_name: string;
            } | null;
            const location = execution.locations as unknown as { name: string } | null;
            const intake = latestIntake.get(execution.id);
            const decision = intake ? latestAuthorization.get(intake.id) : undefined;
            const review = latestReview.get(execution.id);
            return (
              <Card
                key={execution.id}
                title={`${pet?.name} · ${service?.customer_name}`}
                description={`${pet?.breed} · ${location?.name}`}
              >
                <div className="mb-5 flex flex-wrap gap-2">
                  <Badge
                    tone={
                      execution.stage === 'hold'
                        ? 'danger'
                        : execution.stage === 'quality_review'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {execution.stage.replaceAll('_', ' ')}
                  </Badge>
                  {intake ? (
                    <Badge tone={intake.matting_severity === 'severe' ? 'danger' : 'neutral'}>
                      {intake.matting_severity} matting
                    </Badge>
                  ) : null}
                  {decision ? (
                    <Badge tone={decision === 'approved' ? 'success' : 'danger'}>
                      change {decision}
                    </Badge>
                  ) : null}
                  {review ? (
                    <Badge tone={review === 'passed' ? 'success' : 'warning'}>QA {review}</Badge>
                  ) : null}
                </div>
                {!intake && execution.stage === 'intake' ? (
                  <form action={recordGroomingIntake} className="grid gap-4 md:grid-cols-2">
                    <input name="executionId" type="hidden" value={execution.id} />
                    <Field label="Requested style" name="requestedStyle" required />
                    <Field label="Coat condition" name="coatCondition" required />
                    <Field label="Skin condition" name="skinCondition" required />
                    <label className="text-sm font-bold">
                      Matting severity
                      <select className={selectClass} name="mattingSeverity">
                        <option value="none">None</option>
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </select>
                    </label>
                    <Field label="Sensitivities" name="sensitivities" />
                    <Field label="Risks" name="risks" />
                    <Field label="Additional or changed work" name="additionalWork" />
                    <div className="grid gap-3">
                      <label className="flex gap-3 text-sm font-bold">
                        <input name="materialChange" type="checkbox" value="yes" />
                        Material service change
                      </label>
                      <label className="flex gap-3 text-sm font-bold">
                        <input name="priceChange" type="checkbox" value="yes" />
                        Price change
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <Button type="submit">Record intake</Button>
                    </div>
                  </form>
                ) : null}
                {intake && intake.approval_status === 'pending' && !decision ? (
                  <form
                    action={recordGroomingAuthorization}
                    className="grid gap-4 border-t pt-5 md:grid-cols-2"
                  >
                    <input name="intakeId" type="hidden" value={intake.id} />
                    <p className="md:col-span-2 text-sm">
                      <strong>Proposed change:</strong> {intake.additional_work}
                    </p>
                    <label className="text-sm font-bold">
                      Decision
                      <select className={selectClass} name="decision">
                        <option value="approved">Approved</option>
                        <option value="declined">Declined</option>
                      </select>
                    </label>
                    <Field label="Authorized person" name="authorizedByName" required />
                    <label className="text-sm font-bold">
                      Relationship
                      <select className={selectClass} name="authorityRelationship">
                        <option value="owner">Owner</option>
                        <option value="household_member">Household member</option>
                        <option value="authorized_agent">Authorized agent</option>
                      </select>
                    </label>
                    <label className="text-sm font-bold">
                      Method
                      <select className={selectClass} name="method">
                        <option value="in_person">In person</option>
                        <option value="phone">Phone</option>
                        <option value="portal">Portal</option>
                      </select>
                    </label>
                    <Field label="Authority and decision summary" name="summary" required />
                    <div className="self-end">
                      <Button type="submit">Record decision</Button>
                    </div>
                  </form>
                ) : null}
                {execution.stage === 'quality_review' ? (
                  <form
                    action={recordGroomingQualityReview}
                    className="grid gap-4 border-t pt-5 md:grid-cols-2"
                  >
                    <input name="executionId" type="hidden" value={execution.id} />
                    <label className="text-sm font-bold">
                      Outcome
                      <select className={selectClass} name="outcome">
                        <option value="passed">Passed</option>
                        <option value="rework">Needs rework</option>
                        <option value="hold">Hold for review</option>
                      </select>
                    </label>
                    <Field label="Quality notes" name="notes" required />
                    <label className="flex gap-3 text-sm font-bold">
                      <input name="styleVerified" type="checkbox" value="yes" required />
                      Approved style/work verified
                    </label>
                    <label className="flex gap-3 text-sm font-bold">
                      <input name="safetyVerified" type="checkbox" value="yes" required />
                      Safety concerns resolved
                    </label>
                    <label className="flex gap-3 text-sm font-bold">
                      <input name="finishVerified" type="checkbox" value="yes" required />
                      Finish and belongings verified
                    </label>
                    <div className="md:col-span-2">
                      <Button type="submit">Record quality review</Button>
                    </div>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">No active grooming services.</p>
        </Card>
      )}
    </div>
  );
}
