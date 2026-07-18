import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const schema = z.object({
  endsAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime())),
  locationId: z.uuid(),
  petId: z.uuid(),
  quantity: z.coerce.number().int().positive(),
  serviceId: z.uuid(),
  startsAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime())),
  units: z.coerce.number().int().positive(),
});

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
      .eq('status', 'active'),
    supabase
      .from('services')
      .select('id,internal_name')
      .eq('business_id', context.businessId)
      .eq('status', 'active'),
    supabase
      .from('pets')
      .select('id,name,breed')
      .eq('business_id', context.businessId)
      .eq('status', 'active'),
  ]);
  const parsed = schema.safeParse(parameters);
  let errorMessage: string | null = null;
  let quote: null | {
    currency_code: string;
    subtotal_minor: number;
    tax_minor: number;
    total_minor: number;
    deposit_due_minor: number;
    balance_due_minor: number;
    expires_at: string;
  } = null;
  let lines: { id: string; label: string; total_minor: number; explanation: string }[] = [];
  if (Object.keys(parameters).length && !parsed.success) errorMessage = 'Check the quote request.';
  if (parsed.success) {
    const start = new Date(parsed.data.startsAt),
      end = new Date(parsed.data.endsAt);
    if (end <= start) errorMessage = 'The end must be after the start.';
    else {
      const { data: quoteId, error } = await supabase.rpc('calculate_quote', {
        request_key: `staff-${crypto.randomUUID()}`,
        requested_end: end.toISOString(),
        requested_quantity: parsed.data.quantity,
        requested_start: start.toISOString(),
        requested_units: parsed.data.units,
        target_business_id: context.businessId,
        target_location_id: parsed.data.locationId,
        target_pet_id: parsed.data.petId,
        target_service_id: parsed.data.serviceId,
      });
      if (error || typeof quoteId !== 'string')
        errorMessage = 'A complete published price and policy configuration was not found.';
      else {
        const [{ data: quoteData }, { data: lineData }] = await Promise.all([
          supabase
            .from('quotes')
            .select(
              'currency_code,subtotal_minor,tax_minor,total_minor,deposit_due_minor,balance_due_minor,expires_at',
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
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Sales</p>
        <h1 className="text-3xl font-black tracking-tight">Quote preview</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Preview the exact immutable commercial snapshot a booking will use.
        </p>
      </header>
      {errorMessage ? (
        <Alert title="Quote unavailable" tone="danger">
          {errorMessage}
        </Alert>
      ) : null}
      <Card
        title="Calculate a quote"
        description="Units are nights, days, appointments, or occurrences according to the configured rate."
      >
        <form className="grid gap-4 md:grid-cols-3" method="get">
          <label className="text-sm font-bold">
            Location
            <select
              className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
              name="locationId"
              defaultValue={typeof parameters.locationId === 'string' ? parameters.locationId : ''}
            >
              <option value="" disabled>
                Select
              </option>
              {locations?.map((item) => (
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
              name="serviceId"
              defaultValue={typeof parameters.serviceId === 'string' ? parameters.serviceId : ''}
            >
              <option value="" disabled>
                Select
              </option>
              {services?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.internal_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Pet
            <select
              className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
              name="petId"
              defaultValue={typeof parameters.petId === 'string' ? parameters.petId : ''}
            >
              <option value="" disabled>
                Select
              </option>
              {pets?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.breed}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Starts"
            name="startsAt"
            type="datetime-local"
            defaultValue={typeof parameters.startsAt === 'string' ? parameters.startsAt : ''}
            required
          />
          <Field
            label="Ends"
            name="endsAt"
            type="datetime-local"
            defaultValue={typeof parameters.endsAt === 'string' ? parameters.endsAt : ''}
            required
          />
          <Field
            label="Pets/items"
            name="quantity"
            type="number"
            min="1"
            defaultValue={typeof parameters.quantity === 'string' ? parameters.quantity : '1'}
            required
          />
          <Field
            label="Charge units"
            name="units"
            type="number"
            min="1"
            defaultValue={typeof parameters.units === 'string' ? parameters.units : '1'}
            required
          />
          <div className="self-end">
            <Button type="submit">Calculate quote</Button>
          </div>
        </form>
      </Card>
      {quote ? (
        <Card
          title={`${money(quote.total_minor, quote.currency_code)} total`}
          description={`Valid until ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(quote.expires_at))}`}
        >
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="flex justify-between gap-4 border-b pb-3">
                <div>
                  <p className="font-bold">{line.label}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{line.explanation}</p>
                </div>
                <p className="font-bold">{money(line.total_minor, quote.currency_code)}</p>
              </div>
            ))}
          </div>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="font-bold">Subtotal</dt>
              <dd>{money(quote.subtotal_minor, quote.currency_code)}</dd>
            </div>
            <div>
              <dt className="font-bold">Tax</dt>
              <dd>{money(quote.tax_minor, quote.currency_code)}</dd>
            </div>
            <div>
              <dt className="font-bold">Deposit due</dt>
              <dd>{money(quote.deposit_due_minor, quote.currency_code)}</dd>
            </div>
            <div>
              <dt className="font-bold">Remaining balance</dt>
              <dd>{money(quote.balance_due_minor, quote.currency_code)}</dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
