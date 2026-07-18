import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createReportCardDraft, startReportCardCorrection, transitionReportCard } from './actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_report_cards')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: executions }, { data: cards }, { data: versions }] = await Promise.all([
    supabase
      .from('service_executions')
      .select('id,service_category,stage,pets(name),service_versions(customer_name)')
      .eq('business_id', context.businessId)
      .in('stage', ['departure_preparation', 'ready', 'completed']),
    supabase
      .from('report_cards')
      .select(
        'id,service_execution_id,status,current_version_number,pets(name),service_executions(service_versions(customer_name))',
      )
      .eq('business_id', context.businessId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false }),
    supabase
      .from('report_card_versions')
      .select(
        'report_card_id,version_number,status,narrative,highlights,correction_reason,created_at',
      )
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
  ]);
  const cardExecutionIds = new Set((cards ?? []).map((card) => card.service_execution_id));
  const available = (executions ?? []).filter((execution) => !cardExecutionIds.has(execution.id));
  const currentVersions = new Map<string, typeof versions extends (infer T)[] | null ? T : never>();
  for (const version of versions ?? [])
    if (!currentVersions.has(version.report_card_id))
      currentVersions.set(version.report_card_id, version);
  const canApprove = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Customer updates</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Report cards</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Draft from authorized facts, review before delivery, and correct by publishing a new
          version.
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Report card updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Report card action blocked" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {available.length ? (
        <Card
          title="Create report card"
          description="Internal notes and unnotified incidents are excluded from the source snapshot."
        >
          <form action={createReportCardDraft} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">
              Ready service
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-[var(--surface-default)] px-3"
                name="executionId"
              >
                {available.map((execution) => {
                  const pet = execution.pets as unknown as { name: string } | null;
                  const service = execution.service_versions as unknown as {
                    customer_name: string;
                  } | null;
                  return (
                    <option key={execution.id} value={execution.id}>
                      {pet?.name} · {service?.customer_name} ·{' '}
                      {execution.stage.replaceAll('_', ' ')}
                    </option>
                  );
                })}
              </select>
            </label>
            <Field label="Mood" name="mood" required />
            <Field label="Customer narrative" name="narrative" required />
            <Field label="Favorite activity" name="favoriteActivity" />
            <Field label="Care highlight" name="careHighlight" />
            <div className="md:col-span-2">
              <Button type="submit">Create draft</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card
        title="Report-card queue"
        description="Published content is immutable and delivery is idempotent."
      >
        {cards?.length ? (
          <div className="grid gap-5">
            {cards.map((card) => {
              const pet = card.pets as unknown as { name: string } | null;
              const execution = card.service_executions as unknown as {
                service_versions: { customer_name: string } | null;
              } | null;
              const service = execution?.service_versions;
              const version = currentVersions.get(card.id);
              const highlights = version?.highlights as { mood?: string };
              const next =
                card.status === 'draft'
                  ? 'review'
                  : card.status === 'review' || card.status === 'correction_review'
                    ? 'approved'
                    : card.status === 'approved'
                      ? 'published'
                      : null;
              return (
                <article className="rounded-lg border p-4" key={card.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black">
                      {pet?.name} · {service?.customer_name}
                    </p>
                    <Badge
                      tone={
                        card.status === 'published'
                          ? 'success'
                          : card.status === 'approved'
                            ? 'info'
                            : 'warning'
                      }
                    >
                      {card.status.replaceAll('_', ' ')} · v{card.current_version_number}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm">{version?.narrative}</p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Mood: {highlights?.mood}
                  </p>
                  {version?.correction_reason ? (
                    <p className="mt-2 text-sm">
                      <strong>Correction reason:</strong> {version.correction_reason}
                    </p>
                  ) : null}
                  {next && (!['approved', 'published'].includes(next) || canApprove) ? (
                    <form
                      action={transitionReportCard}
                      className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
                    >
                      <input name="reportCardId" type="hidden" value={card.id} />
                      <input name="nextStatus" type="hidden" value={next} />
                      <Field label="Review notes" name="notes" />
                      <Button type="submit">
                        {next === 'review'
                          ? 'Submit for review'
                          : next === 'approved'
                            ? 'Approve'
                            : 'Publish & deliver'}
                      </Button>
                    </form>
                  ) : null}
                  {card.status === 'published' && canApprove ? (
                    <form
                      action={startReportCardCorrection}
                      className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2"
                    >
                      <input name="reportCardId" type="hidden" value={card.id} />
                      <Field label="Corrected narrative" name="narrative" required />
                      <Field label="Corrected mood" name="mood" required />
                      <Field label="Correction reason" name="reason" required />
                      <div className="self-end">
                        <Button type="submit" variant="secondary">
                          Create correction version
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No report cards yet.</p>
        )}
      </Card>
    </div>
  );
}
