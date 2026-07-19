import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { completePetCheckout, recordCheckoutOverride } from './actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
export default async function DeparturesPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_out')) redirect('/denied');
  const parameters = await searchParams;
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
  const canOverride = context.roles.includes('owner') || context.roles.includes('manager');
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--action-primary)]">
            Departure operations
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Checkout & reconciliation</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Release the correct pet only after authority, care, incidents, belongings, report card,
            and balance are reconciled.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-subtle)] px-4 py-2 text-sm font-black">
          {visits?.length ?? 0} in care
        </span>
      </header>
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
      {visits?.length ? (
        <div className="grid gap-6">
          {visits.map((visit) => {
            const pet = visit.pets as unknown as { name: string; breed: string } | null;
            const operational = visit.operational_visits as unknown as {
              booking_id: string;
              scheduled_end: string;
              locations: { name: string } | null;
            } | null;
            const execution = executions?.find((candidate) => candidate.pet_visit_id === visit.id);
            const invoice = invoices?.find(
              (candidate) => candidate.booking_id === operational?.booking_id,
            );
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
              !execution || !['ready', 'completed'].includes(execution.stage)
                ? 'service_not_ready'
                : null,
              tasks?.some((task) => task.pet_visit_id === visit.id) ||
              alerts?.some((alert) => alert.pet_visit_id === visit.id)
                ? 'open_care'
                : null,
              incidents?.some((incident) => incident.pet_visit_id === visit.id)
                ? 'open_incident'
                : null,
              !cards?.some((card) => card.pet_visit_id === visit.id) ? 'report_card_missing' : null,
              balance > 0 ? 'balance_due' : null,
            ].filter(Boolean) as string[];
            return (
              <Card
                className="overflow-hidden border-slate-200"
                key={visit.id}
                title={`${pet?.name} · ${pet?.breed}`}
                description={`${operational?.locations?.name} · scheduled ${new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(operational?.scheduled_end ?? ''))}`}
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
                    <label className="text-sm font-bold">
                      Blocker
                      <select className={selectClass} name="blockerType">
                        {blockers
                          .filter((blocker) => !approved.has(blocker))
                          .map((blocker) => (
                            <option key={blocker} value={blocker}>
                              {blocker.replaceAll('_', ' ')}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Field label="Manager override reason" name="reason" required />
                    <Button type="submit" variant="secondary">
                      Approve exception
                    </Button>
                  </form>
                ) : null}
                <form action={completePetCheckout} className="grid gap-4 md:grid-cols-2">
                  <input name="petVisitId" type="hidden" value={visit.id} />
                  <Field label="Pickup person" name="pickupName" required />
                  <label className="text-sm font-bold">
                    Relationship
                    <select className={selectClass} name="pickupRelationship">
                      <option value="owner">Owner</option>
                      <option value="household_member">Household member</option>
                      <option value="authorized_pickup">Authorized pickup</option>
                      <option value="other">Other / exception</option>
                    </select>
                  </label>
                  <label className="text-sm font-bold">
                    Verification method
                    <select className={selectClass} name="verificationMethod">
                      <option value="photo_id">Photo ID</option>
                      <option value="account_questions">Account questions</option>
                      <option value="known_customer">Known customer</option>
                      <option value="other">Other controlled method</option>
                    </select>
                  </label>
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
                          <select className={selectClass} name={`returnStatus_${item.id}`}>
                            <option value="returned">Returned</option>
                            <option value="consumed">Consumed</option>
                            <option value="disposed">Disposed as authorized</option>
                            <option value="missing">Missing</option>
                            <option value="damaged">Damaged</option>
                          </select>
                          <Field label="Item notes" name={`returnNotes_${item.id}`} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold md:col-span-2">
                    <input name="acknowledged" type="checkbox" value="yes" required />
                    Pickup person, returned property, final care status, report card, and financial
                    status were reviewed.
                  </label>
                  <div className="md:col-span-2">
                    <Button type="submit">Complete pet checkout</Button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">
            No pets currently awaiting checkout.
          </p>
        </Card>
      )}
    </div>
  );
}
