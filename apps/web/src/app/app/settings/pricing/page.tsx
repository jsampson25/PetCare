import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import {
  addDiscountCode,
  addPriceAdjustment,
  addPriceRate,
  createPricingBundle,
  createPricingRevision,
  createStarterPricingBundle,
  publishPricingBundle,
  saveStarterRates,
} from './actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function PricingSettingsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pricing.view')) redirect('/denied');
  const parameters = await searchParams;
  const isOnboarding = parameters.onboarding === '1';
  const supabase = await createSupabaseServerClient();
  const [
    { data: locations },
    { data: priceBooks },
    { data: priceVersions },
    { data: policies },
    { data: allServiceVersions },
    { data: rates },
    { data: services },
  ] = await Promise.all([
    supabase
      .from('locations')
      .select('id,name')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('price_books')
      .select('id,name,currency_code,status')
      .eq('business_id', context.businessId),
    supabase
      .from('price_book_versions')
      .select('id,price_book_id,version_number,status,effective_from')
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
    supabase
      .from('commercial_policy_versions')
      .select(
        'id,location_id,name,version_number,status,deposit_type,deposit_value,tax_rate_bps,customer_summary',
      )
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
    supabase
      .from('service_versions')
      .select('id,service_id,customer_name,version_number,status')
      .eq('business_id', context.businessId)
      .in('status', ['draft', 'published'])
      .order('version_number', { ascending: false }),
    supabase
      .from('price_rate_rules')
      .select('id,price_book_version_id,service_version_id,charge_unit,amount_minor,label')
      .eq('business_id', context.businessId),
    supabase
      .from('services')
      .select('id,category,internal_name,status')
      .eq('business_id', context.businessId)
      .order('display_order'),
  ]);
  const canManage = context.permissions.has('pricing.manage');
  const serviceVersions = (allServiceVersions ?? []).filter(
    (version) => version.status === 'published',
  );
  const latestVersionByService = new Map<string, NonNullable<typeof allServiceVersions>[number]>();
  for (const version of allServiceVersions ?? []) {
    if (!latestVersionByService.has(version.service_id)) {
      latestVersionByService.set(version.service_id, version);
    }
  }
  const starterServices = (services ?? [])
    .map((service) => ({
      ...service,
      version: latestVersionByService.get(service.id),
    }))
    .filter((service) => service.version);
  const drafts = priceVersions?.filter((item) => item.status === 'draft') ?? [];
  const draftPolicies = policies?.filter((item) => item.status === 'draft') ?? [];
  const publishedPrices = priceVersions?.filter((item) => item.status === 'published') ?? [];
  const publishedPolicies = policies?.filter((item) => item.status === 'published') ?? [];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Settings</p>
        <h1 className="text-3xl font-black tracking-tight">Pricing and policies</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Configure money in integer minor units so every quote remains deterministic and
          explainable.
        </p>
      </header>
      {typeof parameters.error === 'string' ? (
        <Alert title="Pricing update failed" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {typeof parameters.notice === 'string' ? (
        <Alert title="Pricing updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {isOnboarding && canManage ? (
        <section className="overflow-hidden rounded-[2rem] border border-[#c9dcf7] bg-white shadow-[0_22px_65px_rgba(37,99,235,.1)]">
          <div className="border-b border-[#dbe7f5] bg-gradient-to-r from-[#eff6ff] via-white to-[#e8f5ff] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">
                  Guided setup · Step 3
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#0b1f3a]">
                  Set your starting prices
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#48617f]">
                  Enter the prices customers understand. Roventra handles cents, percentages, and
                  calculation rules behind the scenes.
                </p>
              </div>
              <div className="min-w-40">
                <div className="flex items-center justify-between text-xs font-bold text-[#48617f]">
                  <span>Setup progress</span>
                  <span>65%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
                  <div className="h-full w-[65%] rounded-full bg-[#2563eb]" />
                </div>
              </div>
            </div>
          </div>
          {!drafts.length && locations?.length ? (
            <form action={createStarterPricingBundle} className="p-6 sm:p-8">
              <input name="locationId" type="hidden" value={locations[0].id} />
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  defaultValue="25"
                  hint="Enter 0 if no deposit is required."
                  label="Booking deposit (%)"
                  max="100"
                  min="0"
                  name="depositPercent"
                  required
                  step="0.01"
                  type="number"
                />
                <Field
                  defaultValue="24"
                  hint="How far ahead customers must cancel."
                  label="Cancellation notice (hours)"
                  max="720"
                  min="0"
                  name="cancellationHours"
                  required
                  type="number"
                />
                <Field
                  defaultValue="25.00"
                  label="Late cancellation fee ($)"
                  min="0"
                  name="cancellationFee"
                  required
                  step="0.01"
                  type="number"
                />
                <Field
                  defaultValue="50.00"
                  label="No-show fee ($)"
                  min="0"
                  name="noShowFee"
                  required
                  step="0.01"
                  type="number"
                />
                <Field
                  defaultValue="0"
                  hint="Confirm the correct rate with your tax professional."
                  label="Sales tax (%)"
                  max="25"
                  min="0"
                  name="taxPercent"
                  required
                  step="0.01"
                  type="number"
                />
              </div>
              <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-[#dbe7f5] pt-6 sm:flex-row sm:items-center">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-[#35506f] hover:bg-[#f1f6fd]"
                  href="/app/settings/services?onboarding=1"
                >
                  ← Back to services
                </Link>
                <Button type="submit">Save policy and continue</Button>
              </div>
            </form>
          ) : null}
          {drafts.length && locations?.length && starterServices.length ? (
            <form action={saveStarterRates} className="p-6 sm:p-8">
              <input name="locationId" type="hidden" value={locations[0].id} />
              <input name="priceVersionId" type="hidden" value={drafts[0].id} />
              <div className="grid gap-4 md:grid-cols-2">
                {starterServices.map((service) => {
                  const unit =
                    service.category === 'boarding'
                      ? 'night'
                      : service.category === 'daycare'
                        ? 'day'
                        : 'appointment';
                  const existingRate = rates?.find(
                    (rate) =>
                      rate.price_book_version_id === drafts[0].id &&
                      rate.service_version_id === service.version?.id,
                  );
                  return (
                    <div
                      className="rounded-2xl border border-[#c9dcf7] bg-[#f8fbff] p-5"
                      key={service.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-[#0b1f3a]">
                            {service.version?.customer_name}
                          </p>
                          <p className="mt-1 text-sm capitalize text-[#526984]">per {unit}</p>
                        </div>
                        {existingRate ? (
                          <span className="rounded-full bg-[#e4f7ed] px-3 py-1 text-xs font-bold text-[#14724a]">
                            ${(existingRate.amount_minor / 100).toFixed(2)} saved
                          </span>
                        ) : null}
                      </div>
                      {existingRate ? null : (
                        <div className="mt-4">
                          <label
                            className="block text-sm font-bold text-[#0b1f3a]"
                            htmlFor={`rate-${service.version?.id}`}
                          >
                            Price ($)
                          </label>
                          <div className="relative mt-2">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#526984]">
                              $
                            </span>
                            <input
                              className="min-h-12 w-full rounded-xl border border-[#9dbce5] bg-white pl-8 pr-4 text-lg font-bold outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
                              id={`rate-${service.version?.id}`}
                              min="0"
                              name={`rate:${service.version?.id}:${unit}`}
                              placeholder="0.00"
                              required
                              step="0.01"
                              type="number"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-[#dbe7f5] pt-6 sm:flex-row sm:items-center">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-[#35506f] hover:bg-[#f1f6fd]"
                  href="/app/settings/services?onboarding=1"
                >
                  ← Back to services
                </Link>
                {starterServices.some(
                  (service) =>
                    !rates?.some(
                      (rate) =>
                        rate.price_book_version_id === drafts[0].id &&
                        rate.service_version_id === service.version?.id,
                    ),
                ) ? (
                  <Button type="submit">Save service prices</Button>
                ) : (
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2563eb] px-5 text-sm font-bold text-white transition hover:bg-[#1d4ed8]"
                    href="/app/settings/services?onboarding=1"
                  >
                    Continue to capacity setup →
                  </Link>
                )}
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
      {canManage && locations?.length ? (
        <Card
          title={
            isOnboarding ? 'Advanced pricing and policy setup' : 'Create a draft pricing bundle'
          }
          description={
            isOnboarding
              ? 'Use these controls when your policies need more detailed configuration.'
              : 'Creates a price-book version and matching location policy/agreement version.'
          }
        >
          <form action={createPricingBundle} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">
              Location
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="locationId"
              >
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Price book name" name="bookName" required />
            <Field label="Currency" name="currency" defaultValue="USD" maxLength={3} required />
            <Field label="Policy name" name="policyName" required />
            <label className="text-sm font-bold">
              Deposit type
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="depositType"
              >
                <option value="none">None</option>
                <option value="fixed">Fixed minor units</option>
                <option value="percentage">Percentage basis points</option>
                <option value="full">Full payment</option>
              </select>
            </label>
            <Field
              label="Deposit value"
              name="depositValue"
              type="number"
              min="0"
              defaultValue="0"
              required
            />
            <Field
              label="Tax rate (basis points)"
              name="taxBps"
              type="number"
              min="0"
              max="10000"
              defaultValue="0"
              required
            />
            <Field
              label="Cancellation notice (hours)"
              name="cancellationHours"
              type="number"
              min="0"
              defaultValue="24"
              required
            />
            <Field
              label="Late cancellation fee (minor units)"
              name="cancellationFee"
              type="number"
              min="0"
              defaultValue="0"
              required
            />
            <Field
              label="No-show fee (minor units)"
              name="noShowFee"
              type="number"
              min="0"
              defaultValue="0"
              required
            />
            <Field label="Agreement title" name="agreementTitle" required />
            <Field label="Customer summary" name="summary" required />
            <label className="text-sm font-bold md:col-span-3">
              Agreement text
              <textarea
                className="mt-2 min-h-32 w-full rounded-lg border bg-white p-3"
                name="agreementBody"
                required
              />
            </label>
            <div className="md:col-span-3">
              <Button type="submit">Create draft bundle</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {canManage && drafts.length && serviceVersions?.length && locations?.length ? (
        <Card
          title="Add a service rate"
          description="Amounts are stored in the currency's minor unit, such as cents for USD."
        >
          <form action={addPriceRate} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">
              Draft price book
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="priceVersionId"
              >
                {drafts.map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Location
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="locationId"
              >
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Published service
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="serviceVersionId"
              >
                {serviceVersions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.customer_name} · v{item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Charge unit
              <select className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3" name="unit">
                <option value="night">Night</option>
                <option value="day">Day</option>
                <option value="appointment">Appointment</option>
                <option value="pet">Pet</option>
                <option value="booking">Booking</option>
                <option value="occurrence">Occurrence</option>
                <option value="quantity">Quantity</option>
              </select>
            </label>
            <Field label="Amount (minor units)" name="amount" type="number" min="0" required />
            <Field label="Customer label" name="label" required />
            <Field
              label="Priority"
              name="priority"
              type="number"
              min="1"
              defaultValue="100"
              required
            />
            <div className="md:col-span-3">
              <Button type="submit">Add rate</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {canManage && publishedPrices.length && publishedPolicies.length ? (
        <Card
          title="Revise published pricing"
          description="Copies published rates, adjustments, discounts, and policy terms into editable draft versions."
        >
          <form action={createPricingRevision} className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-bold">
              Published price version
              <select
                className="ml-2 min-h-11 rounded-lg border bg-white px-3"
                name="priceVersionId"
              >
                {publishedPrices.map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Published policy
              <select
                className="ml-2 min-h-11 rounded-lg border bg-white px-3"
                name="policyVersionId"
              >
                {publishedPolicies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Create revision</Button>
          </form>
        </Card>
      ) : null}
      {canManage && drafts.length && serviceVersions?.length && locations?.length ? (
        <Card
          title="Add seasonal or peak adjustment"
          description="Fixed values use minor units; percentage values use basis points."
        >
          <form action={addPriceAdjustment} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">
              Draft price version
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="priceVersionId"
              >
                {drafts.map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Location
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="locationId"
              >
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Service
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="serviceVersionId"
              >
                {serviceVersions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.customer_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Rule type
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="ruleType"
              >
                <option value="seasonal">Seasonal</option>
                <option value="holiday">Holiday</option>
                <option value="weekend">Saturday</option>
                <option value="peak">Peak</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Adjustment type
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="adjustmentType"
              >
                <option value="fixed">Fixed minor units</option>
                <option value="percentage">Percentage basis points</option>
              </select>
            </label>
            <Field label="Adjustment value" name="adjustmentValue" type="number" min="0" required />
            <Field label="Customer label" name="label" required />
            <Field
              label="Priority"
              name="priority"
              type="number"
              min="1"
              defaultValue="100"
              required
            />
            <div className="self-end">
              <Button type="submit">Add adjustment</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {canManage && drafts.length ? (
        <Card
          title="Add a discount code"
          description="Codes are versioned with the price book and snapshotted into each quote."
        >
          <form action={addDiscountCode} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">
              Draft price version
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="priceVersionId"
              >
                {drafts.map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Code" name="code" required />
            <Field label="Customer label" name="label" required />
            <label className="text-sm font-bold">
              Discount type
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="discountType"
              >
                <option value="fixed">Fixed minor units</option>
                <option value="percentage">Percentage basis points</option>
              </select>
            </label>
            <Field label="Discount value" name="discountValue" type="number" min="0" required />
            <div className="self-end">
              <Button type="submit">Add discount</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {canManage && drafts.length && draftPolicies.length ? (
        <Card
          title="Publish pricing"
          description="Publication freezes both the rate version and the material customer policy."
        >
          <form action={publishPricingBundle} className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-bold">
              Price version
              <select
                className="ml-2 min-h-11 rounded-lg border bg-white px-3"
                name="priceVersionId"
              >
                {drafts.map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Policy version
              <select
                className="ml-2 min-h-11 rounded-lg border bg-white px-3"
                name="policyVersionId"
              >
                {draftPolicies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version_number}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Effective date" name="effectiveDate" type="date" required />
            <Button type="submit">Publish bundle</Button>
          </form>
        </Card>
      ) : null}
      <section className="grid gap-4">
        {priceBooks?.length ? (
          priceBooks.map((book) => {
            const version = priceVersions?.find((item) => item.price_book_id === book.id);
            return (
              <Card
                key={book.id}
                title={book.name}
                description={`${book.currency_code} · ${book.status} · version ${version?.version_number ?? '—'}`}
              >
                <p className="text-sm">
                  {rates?.filter((rate) => rate.price_book_version_id === version?.id).length ?? 0}{' '}
                  configured rates
                </p>
              </Card>
            );
          })
        ) : (
          <Card
            title="No price books yet"
            description="Create the first draft bundle to make published services quotable."
          >
            <p className="text-sm text-[var(--text-secondary)]">
              Pricing must be published before a quote can be calculated.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
