import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const requestSchema = z.object({
  endsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  locationId: z.uuid(),
  petId: z.uuid(),
  quantity: z.coerce.number().int().positive().max(20),
  serviceId: z.uuid(),
  startsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
});

type Explanation = {
  available: boolean;
  capacity_pool_id?: string;
  evaluated_at: string;
  reasons: { code?: string; key?: string; level?: string; message: string }[];
  remaining_capacity: number;
  requires_review: boolean;
  service_version_id?: string;
};

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (
    !context ||
    !context.permissions.has('capacity.view') ||
    !context.permissions.has('pets.view')
  )
    redirect('/denied');
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
      .select('id,internal_name,status')
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
  const parsed = requestSchema.safeParse(parameters);
  let explanation: Explanation | null = null;
  let evaluationError: string | null = null;
  if (Object.keys(parameters).length && !parsed.success)
    evaluationError = 'Choose a location, service, pet, valid interval, and quantity.';
  if (parsed.success) {
    const start = new Date(parsed.data.startsAt);
    const end = new Date(parsed.data.endsAt);
    if (end <= start) evaluationError = 'The requested end must be after the start.';
    else {
      const { data, error } = await supabase.rpc('explain_service_availability', {
        requested_end: end.toISOString(),
        requested_quantity: parsed.data.quantity,
        requested_start: start.toISOString(),
        target_business_id: context.businessId,
        target_location_id: parsed.data.locationId,
        target_pet_id: parsed.data.petId,
        target_service_id: parsed.data.serviceId,
      });
      if (error) evaluationError = 'Availability could not be evaluated.';
      else explanation = data as Explanation;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Operations</p>
        <h1 className="text-3xl font-black tracking-tight">Eligibility and availability</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Check the exact published service rules and remaining capacity before beginning a booking.
        </p>
      </header>
      {evaluationError ? (
        <Alert title="Check unavailable" tone="danger">
          {evaluationError}
        </Alert>
      ) : null}
      <Card
        title="Evaluate a request"
        description="This is an explanation, not a capacity guarantee. A hold or commitment is still required."
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
                Select a location
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
                Select a service
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
                Select a pet
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
            label="Pets or service units"
            name="quantity"
            type="number"
            min="1"
            max="20"
            defaultValue={typeof parameters.quantity === 'string' ? parameters.quantity : '1'}
            required
          />
          <div className="md:col-span-3">
            <Button type="submit">Check eligibility and capacity</Button>
          </div>
        </form>
      </Card>
      {explanation ? (
        <Card
          title={explanation.available ? 'Request can proceed' : 'Request cannot proceed'}
          description={`${explanation.remaining_capacity} units remain after active holds and commitments.`}
        >
          {explanation.requires_review ? (
            <Alert title="Staff review required" tone="info">
              The request has one or more requirements that need staff review.
            </Alert>
          ) : null}
          {explanation.reasons.length ? (
            <ul className="mt-4 space-y-3">
              {explanation.reasons.map((reason, index) => (
                <li key={`${reason.code ?? reason.key}-${index}`} className="rounded-lg border p-3">
                  <p className="font-bold">
                    {reason.code?.replaceAll('_', ' ') ??
                      reason.key?.replaceAll('_', ' ') ??
                      'Review'}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{reason.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No blocking requirements were found.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
