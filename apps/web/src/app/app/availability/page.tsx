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
import {
  formatAvailabilityReason,
  isReviewReason,
  summarizeAvailabilityResult,
} from './availability-result-view';

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

  const resultSummary = explanation ? summarizeAvailabilityResult(explanation) : null;
  const selectedLocation = parsed.success
    ? locations?.find((location) => location.id === parsed.data.locationId)
    : null;
  const selectedService = parsed.success
    ? services?.find((service) => service.id === parsed.data.serviceId)
    : null;
  const selectedPet = parsed.success ? pets?.find((pet) => pet.id === parsed.data.petId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/calendar"
            leadingIcon={<Icon name="calendar" />}
            variant="secondary"
          >
            Open calendar
          </ButtonLink>
        }
        description="Check published service rules and remaining capacity before beginning or changing a booking."
        eyebrow="Operations"
        title="Eligibility and availability"
      />
      {evaluationError ? (
        <Alert title="Check unavailable" tone="danger">
          {evaluationError}
        </Alert>
      ) : null}
      <Card
        description="This is an explanation, not a capacity guarantee. A hold or commitment is still required."
        eyebrow="Request inputs"
        title="Evaluate a service request"
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
            defaultValue={typeof parameters.quantity === 'string' ? parameters.quantity : '1'}
            label="Pets or service units"
            max="20"
            min="1"
            name="quantity"
            required
            type="number"
          />
          <div className="md:col-span-3">
            <Button leadingIcon={<Icon name="check" />} type="submit">
              Check eligibility and capacity
            </Button>
          </div>
        </form>
      </Card>
      {explanation && resultSummary ? (
        <Card
          actions={
            <Badge
              tone={
                resultSummary.decision === 'available'
                  ? 'success'
                  : resultSummary.decision === 'review'
                    ? 'warning'
                    : 'danger'
              }
            >
              {resultSummary.decision === 'available'
                ? 'Can proceed'
                : resultSummary.decision === 'review'
                  ? 'Review required'
                  : 'Blocked'}
            </Badge>
          }
          description={`${explanation.remaining_capacity} units remain after active holds and commitments.`}
          eyebrow="Evaluation result"
          title={
            resultSummary.decision === 'available'
              ? 'Request can proceed'
              : resultSummary.decision === 'review'
                ? 'Request needs staff review'
                : 'Request cannot proceed'
          }
        >
          <dl className="mb-5 grid gap-4 border-b pb-5 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric label="Remaining capacity" value={resultSummary.remainingCapacity} />
            <SummaryMetric label="Blocking reasons" value={resultSummary.blockingReasons} />
            <SummaryMetric label="Review items" value={resultSummary.reviewReasons} />
            <div>
              <dt className="text-sm font-bold text-[var(--text-secondary)]">Evaluated</dt>
              <dd className="mt-1 font-black text-[var(--text-primary)]">
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(explanation.evaluated_at))}
              </dd>
            </div>
          </dl>
          <div className="mb-5 rounded-xl bg-[var(--surface-subtle)] p-4">
            <p className="font-black">
              {selectedPet?.name ?? 'Selected pet'} ·{' '}
              {selectedService?.internal_name ?? 'Selected service'}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {selectedLocation?.name ?? 'Selected location'} ·{' '}
              {parsed.success ? parsed.data.quantity : 0} unit
              {parsed.success && parsed.data.quantity === 1 ? '' : 's'}
            </p>
          </div>
          {explanation.reasons.length ? (
            <ul className="space-y-3">
              {explanation.reasons.map((reason, index) => (
                <li
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                  key={`${reason.code ?? reason.key}-${index}`}
                >
                  <div>
                    <p className="font-bold capitalize">{formatAvailabilityReason(reason)}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{reason.message}</p>
                  </div>
                  <Badge tone={isReviewReason(reason) ? 'warning' : 'danger'}>
                    {isReviewReason(reason) ? 'Review' : 'Blocker'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Alert title="No blocking requirements" tone="success">
              Eligibility and capacity checks passed. Create the booking to secure a hold or
              commitment.
            </Alert>
          )}
          {resultSummary.decision === 'available' ? (
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
