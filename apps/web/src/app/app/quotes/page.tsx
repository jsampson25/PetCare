import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { SelectField } from '@petcare/ui/select-field';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { summarizeQuoteResult } from './quote-result-view';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

const schema = z.object({
  coupon: z.string().trim().max(32).optional(),
  endsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  locationId: z.uuid(),
  petId: z.uuid(),
  quantity: z.coerce.number().int().positive(),
  serviceId: z.uuid(),
  startsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  units: z.coerce.number().int().positive(),
});

type Quote = {
  balance_due_minor: number;
  currency_code: string;
  deposit_due_minor: number;
  discount_minor: number;
  expires_at: string;
  fee_minor: number;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
};

export default async function QuotePage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('quotes.create')) redirect('/denied');

  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: locations }, { data: services }, { data: pets }] = await Promise.all([
    supabase
      .from('locations')
      .select('id,name')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('services')
      .select('id,internal_name')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('internal_name'),
    supabase
      .from('pets')
      .select('id,name,breed')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('name'),
  ]);

  const parsed = schema.safeParse(parameters);
  let errorMessage: string | null = null;
  let quote: Quote | null = null;
  let lines: { id: string; label: string; total_minor: number; explanation: string }[] = [];

  if (Object.keys(parameters).length && !parsed.success) errorMessage = 'Check the quote request.';

  if (parsed.success) {
    const start = new Date(parsed.data.startsAt);
    const end = new Date(parsed.data.endsAt);
    if (end <= start) errorMessage = 'The end must be after the start.';
    else {
      const { data: quoteId, error } = await supabase.rpc('calculate_quote_with_adjustments', {
        coupon_value: parsed.data.coupon || null,
        request_key: `staff-${crypto.randomUUID()}`,
        requested_end: end.toISOString(),
        requested_quantity: parsed.data.quantity,
        requested_start: start.toISOString(),
        requested_units: parsed.data.units,
        target_business_id: context.businessId,
        target_location_id: parsed.data.locationId,
        target_pet_id: parsed.data.petId,
        target_service_id: parsed.data.serviceId,
        superseded_quote: null,
      });
      if (error || typeof quoteId !== 'string')
        errorMessage = 'A complete published price and policy configuration was not found.';
      else {
        const [{ data: quoteData }, { data: lineData }] = await Promise.all([
          supabase
            .from('quotes')
            .select(
              'currency_code,subtotal_minor,discount_minor,fee_minor,tax_minor,total_minor,deposit_due_minor,balance_due_minor,expires_at',
            )
            .eq('business_id', context.businessId)
            .eq('id', quoteId)
            .single(),
          supabase
            .from('quote_lines')
            .select('id,label,total_minor,explanation')
            .eq('business_id', context.businessId)
            .eq('quote_id', quoteId)
            .order('display_order'),
        ]);
        quote = quoteData;
        lines = lineData ?? [];
      }
    }
  }

  const selectedLocation = parsed.success
    ? locations?.find((location) => location.id === parsed.data.locationId)
    : null;
  const selectedService = parsed.success
    ? services?.find((service) => service.id === parsed.data.serviceId)
    : null;
  const selectedPet = parsed.success ? pets?.find((pet) => pet.id === parsed.data.petId) : null;
  const summary = quote ? summarizeQuoteResult(quote) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/availability"
            leadingIcon={<Icon name="calendar" />}
            variant="secondary"
          >
            Check availability
          </ButtonLink>
        }
        description="Preview the immutable commercial snapshot a booking will use before presenting pricing to a customer."
        eyebrow="Sales"
        title="Quote preview"
      />
      {errorMessage ? (
        <Alert title="Quote unavailable" tone="danger">
          {errorMessage}
        </Alert>
      ) : null}
      <Card
        description="Units are nights, days, appointments, or occurrences according to the configured rate."
        eyebrow="Quote inputs"
        title="Calculate a quote"
      >
        <form className="grid gap-4 md:grid-cols-3" method="get">
          <SelectField
            defaultValue={typeof parameters.locationId === 'string' ? parameters.locationId : ''}
            label="Location"
            name="locationId"
            required
          >
            <option value="" disabled>
              Select a location
            </option>
            {locations?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            defaultValue={typeof parameters.serviceId === 'string' ? parameters.serviceId : ''}
            label="Service"
            name="serviceId"
            required
          >
            <option value="" disabled>
              Select a service
            </option>
            {services?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.internal_name}
              </option>
            ))}
          </SelectField>
          <SelectField
            defaultValue={typeof parameters.petId === 'string' ? parameters.petId : ''}
            label="Pet"
            name="petId"
            required
          >
            <option value="" disabled>
              Select a pet
            </option>
            {pets?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.breed}
              </option>
            ))}
          </SelectField>
          <Field
            defaultValue={typeof parameters.startsAt === 'string' ? parameters.startsAt : ''}
            label="Starts"
            name="startsAt"
            required
            type="datetime-local"
          />
          <Field
            defaultValue={typeof parameters.endsAt === 'string' ? parameters.endsAt : ''}
            label="Ends"
            name="endsAt"
            required
            type="datetime-local"
          />
          <Field
            defaultValue={typeof parameters.coupon === 'string' ? parameters.coupon : ''}
            label="Discount code (optional)"
            name="coupon"
          />
          <Field
            defaultValue={typeof parameters.quantity === 'string' ? parameters.quantity : '1'}
            label="Pets or items"
            min="1"
            name="quantity"
            required
            type="number"
          />
          <Field
            defaultValue={typeof parameters.units === 'string' ? parameters.units : '1'}
            label="Charge units"
            min="1"
            name="units"
            required
            type="number"
          />
          <div className="self-end">
            <Button leadingIcon={<Icon name="check" />} type="submit">
              Calculate quote
            </Button>
          </div>
        </form>
      </Card>
      {quote && summary ? (
        <Card
          actions={
            <Badge
              tone={
                summary.validity === 'active'
                  ? 'success'
                  : summary.validity === 'expiring'
                    ? 'warning'
                    : 'danger'
              }
            >
              {summary.validity}
            </Badge>
          }
          description={`Valid until ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(quote.expires_at))}`}
          eyebrow="Commercial snapshot"
          title={`${money(quote.total_minor, quote.currency_code)} total`}
        >
          {!summary.reconciled ? (
            <Alert title="Quote total needs review" tone="danger">
              The displayed components do not reconcile to the saved total. Do not present this
              quote until pricing configuration is reviewed.
            </Alert>
          ) : null}
          <div className="my-5 rounded-xl bg-[var(--surface-subtle)] p-4">
            <p className="font-black">
              {selectedPet?.name ?? 'Selected pet'} ·{' '}
              {selectedService?.internal_name ?? 'Selected service'}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {selectedLocation?.name ?? 'Selected location'} ·{' '}
              {parsed.success ? parsed.data.quantity : 0} item
              {parsed.success && parsed.data.quantity === 1 ? '' : 's'} ·{' '}
              {parsed.success ? parsed.data.units : 0} charge unit
              {parsed.success && parsed.data.units === 1 ? '' : 's'}
            </p>
          </div>
          <dl className="mb-5 grid gap-4 border-b pb-5 sm:grid-cols-2 lg:grid-cols-4">
            <MoneyMetric currency={quote.currency_code} label="Total" value={quote.total_minor} />
            <MoneyMetric
              currency={quote.currency_code}
              label="Deposit due"
              value={summary.dueNow}
            />
            <MoneyMetric
              currency={quote.currency_code}
              label="Balance later"
              value={summary.dueLater}
            />
            <MoneyMetric currency={quote.currency_code} label="Discounts" value={summary.savings} />
          </dl>
          <div className="space-y-3">
            {lines.map((line) => (
              <div className="flex justify-between gap-4 border-b pb-3" key={line.id}>
                <div>
                  <p className="font-bold">{line.label}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{line.explanation}</p>
                </div>
                <p className="font-bold">{money(line.total_minor, quote.currency_code)}</p>
              </div>
            ))}
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <BreakdownItem
              label="Subtotal"
              value={money(quote.subtotal_minor, quote.currency_code)}
            />
            <BreakdownItem label="Fees" value={money(quote.fee_minor, quote.currency_code)} />
            <BreakdownItem label="Tax" value={money(quote.tax_minor, quote.currency_code)} />
            <BreakdownItem
              label="Discounts"
              value={`−${money(quote.discount_minor, quote.currency_code)}`}
            />
          </dl>
          {summary.validity !== 'expired' && summary.reconciled ? (
            <div className="mt-5">
              <ButtonLink href="/app/bookings/new" leadingIcon={<Icon name="arrow-right" />}>
                Start booking
              </ButtonLink>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
}

function MoneyMetric({
  currency,
  label,
  value,
}: {
  currency: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <dt className="text-sm font-bold text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">
        {money(value, currency)}
      </dd>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-1 font-black text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}
