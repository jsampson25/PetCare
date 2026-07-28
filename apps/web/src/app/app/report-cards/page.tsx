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
import { createReportCardDraft, startReportCardCorrection, transitionReportCard } from './actions';
import { filterReportCardQueue, summarizeReportCardQueue } from './report-card-queue-view';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.manage_report_cards')) redirect('/denied');
  const parameters = await searchParams;
  const categoryParameter = typeof parameters.category === 'string' ? parameters.category : 'all';
  const requestedCategory = ['all', 'boarding', 'daycare', 'grooming'].includes(categoryParameter)
    ? categoryParameter
    : 'all';
  const statusParameter = typeof parameters.status === 'string' ? parameters.status : 'all';
  const requestedStatus = ['all', 'draft', 'review', 'approved', 'published'].includes(
    statusParameter,
  )
    ? statusParameter
    : 'all';
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
        'id,service_execution_id,status,current_version_number,pets(name),service_executions(service_category,service_versions(customer_name))',
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
  const queueCards = (cards ?? []).map((card) => {
    const execution = card.service_executions as unknown as {
      service_category: string;
    } | null;
    return { ...card, service_category: execution?.service_category ?? '' };
  });
  const visibleCards = filterReportCardQueue(queueCards, requestedCategory, requestedStatus);
  const summary = summarizeReportCardQueue(queueCards, available.length);
  const canApprove = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/departures"
            leadingIcon={<Icon name="departures" />}
            variant="secondary"
          >
            Checkout queue
          </ButtonLink>
        }
        description="Draft from authorized facts, review before delivery, and correct by publishing a new version."
        eyebrow="Customer updates"
        title="Report cards"
      />
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
      <CommandBar
        description="Focus authoring and approval work by service line and publishing stage."
        title="Filter report-card work"
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
            defaultValue={requestedStatus}
            density="compact"
            label="Publishing stage"
            name="status"
          >
            <option value="all">All report cards</option>
            <option value="draft">Draft</option>
            <option value="review">In review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Delivery summary" title="Report-card workload" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryMetric label="Ready to draft" value={summary.available} />
          <SummaryMetric label="Drafting" value={summary.authoring} />
          <SummaryMetric label="In review" value={summary.review} />
          <SummaryMetric label="Approved" value={summary.approved} />
          <SummaryMetric label="Published" value={summary.published} />
        </dl>
      </Card>
      {available.length ? (
        <Card
          title="Create report card"
          description="Internal notes and unnotified incidents are excluded from the source snapshot."
        >
          <form action={createReportCardDraft} className="grid gap-4 md:grid-cols-2">
            <SelectField label="Ready service" name="executionId">
              {available.map((execution) => {
                const pet = execution.pets as unknown as { name: string } | null;
                const service = execution.service_versions as unknown as {
                  customer_name: string;
                } | null;
                return (
                  <option key={execution.id} value={execution.id}>
                    {pet?.name} · {service?.customer_name} · {execution.stage.replaceAll('_', ' ')}
                  </option>
                );
              })}
            </SelectField>
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
        {visibleCards.length ? (
          <div className="grid gap-5">
            {visibleCards.map((card) => {
              const pet = card.pets as unknown as { name: string } | null;
              const execution = card.service_executions as unknown as {
                service_category: string;
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
                    {execution?.service_category} Â· Mood: {highlights?.mood}
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
          <StatePanel
            description={
              cards?.length
                ? 'No report cards match the selected service and publishing stage.'
                : 'Eligible services will appear here when their customer update is ready to draft.'
            }
            size="compact"
            title={cards?.length ? 'No matching report cards' : 'No report cards yet'}
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
