import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { notFound, redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import {
  acceptOperationalHandoff,
  addVisitCareAmendment,
  completePetCheckIn,
  recordArrival,
  resolveCheckInBlocker,
} from '../actions';

type PageParameters = Promise<{ bookingId: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
const selectClass =
  'mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3';
export default async function ArrivalDetailPage({
  params,
  searchParams,
}: {
  params: PageParameters;
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const { bookingId } = await params;
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id,location_id,booking_number,status,customers(first_name,last_name,email,phone),locations(name)',
    )
    .eq('business_id', context.businessId)
    .eq('id', bookingId)
    .single();
  if (!booking) notFound();
  const [{ data: items }, { data: visit }, { data: actions }, { data: resources }] =
    await Promise.all([
      supabase
        .from('booking_items')
        .select(
          'id,pet_id,starts_at,ends_at,pets(name,breed),service_versions(customer_name,service_id)',
        )
        .eq('business_id', context.businessId)
        .eq('booking_id', bookingId)
        .eq('status', 'confirmed'),
      supabase
        .from('operational_visits')
        .select(
          'id,status,arrived_at,checked_in_at,pet_visits(id,pet_id,status,handoff_status,checked_in_at,care_plan_amendments(id,category,reason,amendment,created_at))',
        )
        .eq('business_id', context.businessId)
        .eq('booking_id', bookingId)
        .maybeSingle(),
      supabase
        .from('booking_action_items')
        .select('id,title,status,blocking,action_type,metadata')
        .eq('business_id', context.businessId)
        .eq('booking_id', bookingId)
        .eq('status', 'open'),
      supabase
        .from('capacity_resources')
        .select(
          'id,label,resource_code,resource_type,status,max_pets,capacity_pools!inner(location_id,service_id)',
        )
        .eq('business_id', context.businessId)
        .eq('capacity_pools.location_id', booking.location_id)
        .in('status', ['ready', 'occupied'])
        .order('label'),
    ]);
  const customer = booking.customers as unknown as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
  const location = booking.locations as unknown as { name: string } | null;
  const petVisits = (visit?.pet_visits ?? []) as {
    id: string;
    pet_id: string;
    status: string;
    handoff_status: string;
    checked_in_at: string | null;
    care_plan_amendments: {
      id: string;
      category: string;
      reason: string;
      amendment: { instructions?: string };
      created_at: string;
    }[];
  }[];
  const blockers = (actions ?? []).filter((action) => action.blocking);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">
          {location?.name} · {booking.booking_number}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Operational check-in</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          {customer?.first_name} {customer?.last_name} · {customer?.phone}
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Check-in updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Check-in blocked" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {blockers.length ? (
        <Alert title="Booking blockers remain" tone="warning">
          Resolve {blockers.map((b) => b.title).join(', ')} before accepting custody.
        </Alert>
      ) : null}
      {blockers.length && context.roles.some((role) => role === 'owner' || role === 'manager') ? (
        <Card
          title="Manager resolution"
          description="Clinical eligibility, deposits, and approvals remain non-overrideable and must use their authoritative workflow."
        >
          <div className="grid gap-5">
            {blockers.map((blocker) => (
              <form
                action={resolveCheckInBlocker}
                className="grid gap-4 rounded-lg border p-4"
                key={blocker.id}
              >
                <input name="actionId" type="hidden" value={blocker.id} />
                <input name="bookingId" type="hidden" value={bookingId} />
                <div>
                  <p className="font-black">{blocker.title}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {blocker.action_type.replaceAll('_', ' ')}
                  </p>
                </div>
                <label className="text-sm font-bold">
                  Resolution
                  <select className={selectClass} name="resolution">
                    <option value="requirement_satisfied">Requirement satisfied</option>
                    <option value="approved_exception">Approved exception</option>
                  </select>
                </label>
                <Field
                  label="Evidence and reason"
                  name="reason"
                  required
                  hint="Describe what was verified. An exception only works when policy marks this action overrideable."
                />
                <Button type="submit" variant="secondary">
                  Record manager resolution
                </Button>
              </form>
            ))}
          </div>
        </Card>
      ) : null}
      <Card
        title="1. Record arrival"
        description="Arrival only means the customer and pet are physically present. It does not transfer custody."
      >
        <div className="flex items-center justify-between gap-4">
          <Badge
            tone={
              visit?.status === 'in_care'
                ? 'success'
                : visit?.status === 'arrived'
                  ? 'warning'
                  : 'info'
            }
          >
            {visit?.status?.replaceAll('_', ' ') ?? 'expected'}
          </Badge>
          {!visit ? (
            <form action={recordArrival}>
              <input name="bookingId" type="hidden" value={bookingId} />
              <Button type="submit">Record arrival</Button>
            </form>
          ) : null}
        </div>
      </Card>
      {visit
        ? items?.map((item) => {
            const pet = item.pets as unknown as { name: string; breed: string } | null;
            const service = item.service_versions as unknown as {
              customer_name: string;
              service_id: string;
            } | null;
            const petVisit = petVisits.find((entry) => entry.pet_id === item.pet_id);
            const complete = petVisit?.status === 'in_care';
            const compatibleResources = (resources ?? []).filter((resource) => {
              const pool = resource.capacity_pools as unknown as { service_id: string } | null;
              return pool?.service_id === service?.service_id;
            });
            return (
              <div className="space-y-5" key={item.id}>
                <Card
                  title={`2. ${pet?.name} safety and custody review`}
                  description={`${service?.customer_name} · verify against the pet in front of you, not only the screen.`}
                >
                  {complete ? (
                    <Alert title="Custody accepted" tone="success">
                      The immutable care snapshot and intake record are secured for this visit.
                    </Alert>
                  ) : (
                    <form action={completePetCheckIn} className="grid gap-5">
                      <input name="bookingId" type="hidden" value={bookingId} />
                      <input name="petId" type="hidden" value={item.pet_id} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Presenter full name" name="presenterName" required />
                        <label className="text-sm font-bold">
                          Relationship
                          <select className={selectClass} name="relationship" required>
                            <option value="owner">Owner</option>
                            <option value="household_member">Household member</option>
                            <option value="authorized_pickup">Authorized contact</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className="text-sm font-bold">
                          Presenter verification
                          <select className={selectClass} name="verificationMethod" required>
                            <option value="photo_id">Photo ID</option>
                            <option value="account_questions">Account questions</option>
                            <option value="known_customer">Known customer</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="font-black">Two-point pet identity check</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          Confirm both values against the pet and presenter before continuing.
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <Field
                            label="Confirmed pet name"
                            name="petName"
                            defaultValue={pet?.name}
                            required
                          />
                          <Field
                            label="Confirmed breed / appearance"
                            name="petBreed"
                            defaultValue={pet?.breed}
                            required
                          />
                        </div>
                      </div>
                      <Field
                        label="Arrival condition notes"
                        name="conditionNotes"
                        hint="Record injuries, coat condition, mobility, demeanor, or no concerns."
                      />
                      <div className="rounded-lg border p-4">
                        <p className="font-black">Optional item accepted into custody</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="text-sm font-bold">
                            Category
                            <select className={selectClass} name="itemCategory">
                              <option value="belonging">Belonging</option>
                              <option value="food">Food</option>
                              <option value="medication">Medication</option>
                            </select>
                          </label>
                          <Field label="Item name" name="itemName" />
                          <Field
                            label="Quantity"
                            name="itemQuantity"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue="1"
                          />
                          <Field label="Unit" name="itemUnit" defaultValue="item" />
                          <Field label="Storage location" name="storageLocation" />
                        </div>
                      </div>
                      <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold">
                        <input name="safetyConfirmed" type="checkbox" value="yes" required />I
                        reviewed identity, active care information, arrival condition, and all items
                        being transferred.
                      </label>
                      <Button type="submit" disabled={blockers.length > 0}>
                        Accept custody and check in {pet?.name}
                      </Button>
                    </form>
                  )}
                </Card>
                {complete ? (
                  <Card
                    title={`3. ${pet?.name} operational handoff`}
                    description="The receiving staff member confirms the physical handoff and assigned location."
                  >
                    {petVisit?.handoff_status === 'accepted' ? (
                      <Alert title="Handoff accepted" tone="success">
                        The care team has accepted responsibility for {pet?.name}.
                      </Alert>
                    ) : (
                      <form action={acceptOperationalHandoff} className="grid gap-5">
                        <input name="bookingId" type="hidden" value={bookingId} />
                        <input name="petVisitId" type="hidden" value={petVisit?.id} />
                        <label className="text-sm font-bold">
                          Housing or service resource
                          <select className={selectClass} name="resourceId">
                            <option value="">No named resource required</option>
                            {compatibleResources.map((resource) => (
                              <option key={resource.id} value={resource.id}>
                                {resource.label} · {resource.resource_type.replaceAll('_', ' ')} ·{' '}
                                {resource.status}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Field
                          label="Receiving notes"
                          name="handoffNotes"
                          hint="Include supply location, first priority, settling needs, or a nonblocking follow-up."
                        />
                        <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold">
                          <input name="handoffConfirmed" type="checkbox" value="yes" required />I am
                          the receiving staff member and accept responsibility for this pet.
                        </label>
                        <Button type="submit">Accept operational handoff</Button>
                      </form>
                    )}
                  </Card>
                ) : null}
                {complete ? (
                  <Card
                    title={`Visit-only care changes for ${pet?.name}`}
                    description="These instructions change this visit's operational truth. They never silently rewrite the master pet profile."
                  >
                    {petVisit?.care_plan_amendments?.length ? (
                      <div className="mb-5 divide-y rounded-lg border px-4">
                        {petVisit.care_plan_amendments.map((amendment) => (
                          <div className="py-3" key={amendment.id}>
                            <p className="font-bold">{amendment.category.replaceAll('_', ' ')}</p>
                            <p className="text-sm">{amendment.amendment.instructions}</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              Reason: {amendment.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <form action={addVisitCareAmendment} className="grid gap-4">
                      <input name="bookingId" type="hidden" value={bookingId} />
                      <input name="petVisitId" type="hidden" value={petVisit?.id} />
                      <label className="text-sm font-bold">
                        Care category
                        <select className={selectClass} name="category">
                          <option value="feeding">Feeding</option>
                          <option value="behavior">Behavior / handling</option>
                          <option value="general">General</option>
                          <option value="medication">Medication — manager required</option>
                          <option value="allergy">Allergy — manager required</option>
                          <option value="health">Health — manager required</option>
                        </select>
                      </label>
                      <Field label="Instructions for this visit" name="instructions" required />
                      <Field label="Reason for change" name="reason" required />
                      <label className="flex gap-3 rounded-lg border p-4 text-sm font-bold">
                        <input name="proposeMasterUpdate" type="checkbox" value="yes" />
                        Also flag this for separate master-profile review.
                      </label>
                      <Button type="submit" variant="secondary">
                        Add visit care amendment
                      </Button>
                    </form>
                  </Card>
                ) : null}
              </div>
            );
          })
        : null}
    </div>
  );
}
