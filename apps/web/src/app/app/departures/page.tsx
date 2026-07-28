import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { Field } from '@petcare/ui/field';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { completePetCheckout, recordCheckoutOverride } from './actions';
import { filterDepartureQueue, summarizeDepartureQueue } from './departure-queue-view';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function DeparturesPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_out')) redirect('/denied');
  const parameters = await searchParams;
  const viewParameter = typeof parameters.view === 'string' ? parameters.view : 'all';
  const requestedView = [
    'all',
    'ready',
    'blocked',
    'open_care',
    'open_incident',
    'balance_due',
  ].includes(viewParameter)
    ? viewParameter
    : 'all';
  const supabase = await createSupabaseServerClient();
  const [
    { data: visits },
    { data: executions },
    { data: tasks },
    { data: alerts },
    { data: incidents },
    { data: cards },
    { data: custody },
    { data: invoices },
    { data: balances },
    { data: overrides },
  ] = await Promise.all([
    supabase
      .from('pet_visits')
      .select(
        'id,operational_visit_id,pets(name,breed),operational_visits(booking_id,scheduled_end,locations(name))',
      )
      .eq('business_id', context.businessId)
      .eq('status', 'in_care')
      .order('created_at'),
    supabase
      .from('service_executions')
      .select('pet_visit_id,stage,service_category')
      .eq('business_id', context.businessId),
    supabase
      .from('care_tasks')
      .select('pet_visit_id,status')
      .eq('business_id', context.businessId)
      .in('status', ['scheduled', 'in_progress']),
    supabase
      .from('operational_alerts')
      .select('pet_visit_id,status')
      .eq('business_id', context.businessId)
      .in('status', ['open', 'acknowledged']),
    supabase
      .from('operational_incidents')
      .select('pet_visit_id,status')
      .eq('business_id', context.businessId)
      .not('status', 'in', '(resolved,closed)'),
    supabase
      .from('report_cards')
      .select('pet_visit_id,status')
      .eq('business_id', context.businessId)
      .eq('status', 'published'),
    supabase
      .from('visit_custody_items')
      .select('id,pet_visit_id,category,item_name,quantity,unit,return_expected')
      .eq('business_id', context.businessId),
    supabase
      .from('invoices')
      .select('id,booking_id,currency_code')
      .eq('business_id', context.businessId)
      .neq('status', 'void'),
    supabase
      .from('invoice_balances')
      .select('invoice_id,balance_due_minor')
      .eq('business_id', context.businessId),
    supabase
      .from('checkout_overrides')
      .select('pet_visit_id,blocker_type')
      .eq('business_id', context.businessId),
  ]);
  const balanceMap = new Map(
    (balances ?? []).map((balance) => [balance.invoice_id, balance.balance_due_minor]),
  );
  const departureRows = (visits ?? []).map((visit) => {
    const pet = visit.pets as unknown as { name: string; breed: string } | null;
    const operational = visit.operational_visits as unknown as {
      booking_id: string;
      scheduled_end: string;
      locations: { name: string } | null;
    } | null;
    const execution = executions?.find((candidate) => candidate.pet_visit_id === visit.id);
    const invoice = invoices?.find((candidate) => candidate.booking_id === operational?.booking_id);
    const balance = invoice ? (balanceMap.get(invoice.id) ?? 0) : 0;
    const items = (custody ?? []).filter(
      (item) => item.pet_visit_id === visit.id && item.return_expected,
    );
    const approved = new Set(
      (overrides ?? [])
        .filter((override) => override.pet_visit_id === visit.id)
        .map((override) => override.blocker_type),
    );
    const blockers = [
      !execution || !['ready', 'completed'].includes(execution.stage) ? 'service_not_ready' : null,
      tasks?.some((task) => task.pet_visit_id === visit.id) ||
      alerts?.some((alert) => alert.pet_visit_id === visit.id)
        ? 'open_care'
        : null,
      incidents?.some((incident) => incident.pet_visit_id === visit.id) ? 'open_incident' : null,
      !cards?.some((card) => card.pet_visit_id === visit.id) ? 'report_card_missing' : null,
      balance > 0 ? 'balance_due' : null,
    ].filter(Boolean) as string[];
    return {
      visit,
      pet,
      operational,
      invoice,
      balance,
      balance_due_minor: balance,
      items,
      approved,
      blockers,
    };
  });
  const visibleRows = filterDepartureQueue(departureRows, requestedView);
  const summary = summarizeDepartureQueue(departureRows);
  const canOverride = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/report-cards"
            leadingIcon={<Icon name="clipboard" />}
            variant="secondary"
          >
            Report cards
          </ButtonLink>
        }
        description="Release the correct pet only after authority, care, incidents, belongings, report card, and balance are reconciled."
        eyebrow="Departure operations"
        title="Checkout & reconciliation"
      />
      {typeof parameters.notice === 'string' ? (
        <Alert title="Departure updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Checkout blocked" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <CommandBar
        description="Separate pets ready for release from the operational, safety, and financial blockers requiring follow-up."
        title="Filter checkout queue"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField
            defaultValue={requestedView}
            density="compact"
            label="Departure view"
            name="view"
          >
            <option value="all">All pets in care</option>
            <option value="ready">Ready for checkout</option>
            <option value="blocked">Any blocker</option>
            <option value="open_care">Open care work</option>
            <option value="open_incident">Open incident</option>
            <option value="balance_due">Balance due</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filter
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Departure summary" title="Checkout readiness" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Ready" value={summary.ready} />
          <SummaryMetric label="Blocked" value={summary.blocked} />
          <SummaryMetric label="Open care" value={summary.openCare} />
          <SummaryMetric label="Balance due" value={summary.balanceDue} />
        </dl>
      </Card>
      {visibleRows.length ? (
        <div className="grid gap-6">
          {visibleRows.map(
            ({ visit, pet, operational, invoice, balance, items, approved, blockers }) => {
              return (
                <Card
                  actions={
                    <Badge tone={blockers.length ? 'warning' : 'success'}>
                      {blockers.length
                        ? `${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`
                        : 'Ready'}
                    </Badge>
                  }
                  className="overflow-hidden border-slate-200"
                  description={`${operational?.locations?.name} · scheduled ${new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(operational?.scheduled_end ?? ''))}`}
                  eyebrow="Checkout record"
                  key={visit.id}
                  title={`${pet?.name} · ${pet?.breed}`}
                >
                  <div className="mb-5 flex flex-wrap gap-2">
                    {blockers.length ? (
                      blockers.map((blocker) => (
                        <Badge key={blocker} tone={approved.has(blocker) ? 'warning' : 'danger'}>
                          {blocker.replaceAll('_', ' ')}
                          {approved.has(blocker) ? ' · overridden' : ''}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="success">operationally ready</Badge>
                    )}
                    <Badge tone={balance > 0 ? 'danger' : 'success'}>
                      {invoice?.currency_code ?? 'USD'} {(balance / 100).toFixed(2)} due
                    </Badge>
                  </div>
                  {canOverride && blockers.some((blocker) => !approved.has(blocker)) ? (
                    <form
                      action={recordCheckoutOverride}
                      className="mb-5 grid gap-3 border-b pb-5 md:grid-cols-[1fr_2fr_auto]"
                    >
                      <input name="petVisitId" type="hidden" value={visit.id} />
                      <SelectField label="Blocker" name="blockerType">
                        {blockers
                          .filter((blocker) => !approved.has(blocker))
                          .map((blocker) => (
                            <option key={blocker} value={blocker}>
                              {blocker.replaceAll('_', ' ')}
                            </option>
                          ))}
                      </SelectField>
                      <Field label="Manager override reason" name="reason" required />
                      <Button leadingIcon={<Icon name="check" />} type="submit" variant="secondary">
                        Approve exception
                      </Button>
                    </form>
                  ) : null}
                  <form action={completePetCheckout} className="grid gap-4 md:grid-cols-2">
                    <input name="petVisitId" type="hidden" value={visit.id} />
                    <Field label="Pickup person" name="pickupName" required />
                    <SelectField label="Relationship" name="pickupRelationship">
                      <option value="owner">Owner</option>
                      <option value="household_member">Household member</option>
                      <option value="authorized_pickup">Authorized pickup</option>
                      <option value="other">Other / exception</option>
                    </SelectField>
                    <SelectField label="Verification method" name="verificationMethod">
                      <option value="photo_id">Photo ID</option>
                      <option value="account_questions">Account questions</option>
                      <option value="known_customer">Known customer</option>
                      <option value="other">Other controlled method</option>
                    </SelectField>
                    <Field label="Identity evidence 1" name="identityOne" required />
                    <Field label="Identity evidence 2" name="identityTwo" required />
                    <Field label="Customer handoff notes" name="handoffNotes" />
                    {items.length ? (
                      <div className="grid gap-3 md:col-span-2">
                        <p className="font-black">Belongings, food, and medication</p>
                        {items.map((item) => (
                          <div
                            className="grid gap-3 rounded-lg border p-3 md:grid-cols-3"
                            key={item.id}
                          >
                            <input name="returnItemId" type="hidden" value={item.id} />
                            <p className="text-sm font-bold">
                              {item.item_name} · {item.quantity} {item.unit}
                            </p>
                            <SelectField label="Return outcome" name={`returnStatus_${item.id}`}>
                              <option value="returned">Returned</option>
                              <option value="consumed">Consumed</option>
                              <option value="disposed">Disposed as authorized</option>
                              <option value="missing">Missing</option>
                              <option value="damaged">Damaged</option>
                            </SelectField>
                            <Field label="Item notes" name={`returnNotes_${item.id}`} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold md:col-span-2">
                      <input name="acknowledged" type="checkbox" value="yes" required />
                      Pickup person, returned property, final care status, report card, and
                      financial status were reviewed.
                    </label>
                    <div className="md:col-span-2">
                      <Button leadingIcon={<Icon name="check" />} type="submit">
                        Complete pet checkout
                      </Button>
                    </div>
                  </form>
                </Card>
              );
            },
          )}
        </div>
      ) : (
        <StatePanel
          description={
            visits?.length
              ? 'No pets match the selected checkout readiness view.'
              : 'Pets will appear here after check-in and remain until checkout is reconciled.'
          }
          title={visits?.length ? 'No matching departures' : 'No pets awaiting checkout'}
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
