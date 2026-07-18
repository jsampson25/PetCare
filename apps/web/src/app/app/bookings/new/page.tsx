import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createBookingRequest, createWaitlistEntry } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function NewBookingPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.create')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: locations }, { data: services }, { data: customers }, { data: pets }] =
    await Promise.all([
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
        .from('customers')
        .select('id,first_name,last_name,email')
        .eq('business_id', context.businessId)
        .eq('status', 'active')
        .order('last_name'),
      supabase
        .from('pets')
        .select('id,name,breed')
        .eq('business_id', context.businessId)
        .eq('status', 'active')
        .order('name'),
    ]);
  const selectors = (
    <>
      <label className="text-sm font-bold">
        Location
        <select
          className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
          name="locationId"
          required
        >
          <option value="">Select</option>
          {locations?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Customer
        <select
          className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
          name="customerId"
          required
        >
          <option value="">Select</option>
          {customers?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.last_name}, {item.first_name} · {item.email}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Pet
        <select
          className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
          name="petId"
          required
        >
          <option value="">Select</option>
          {pets?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.breed}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Service
        <select
          className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
          name="serviceId"
          required
        >
          <option value="">Select</option>
          {services?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.internal_name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Starts" name="startsAt" type="datetime-local" required />
      <Field label="Ends" name="endsAt" type="datetime-local" required />
      <Field
        label="Pets / capacity units"
        name="quantity"
        type="number"
        min="1"
        max="20"
        defaultValue="1"
        required
      />
    </>
  );
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Reservations</p>
        <h1 className="text-3xl font-black tracking-tight">Create a booking request</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Eligibility, live capacity, published pricing, deposit policy, and confirmation mode are
          checked together.
        </p>
      </header>
      {typeof parameters.error === 'string' ? (
        <Alert title="Request not created" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <Card
        title="Booking details"
        description="The resulting status clearly distinguishes confirmed, pending deposit, pending approval, and action required."
      >
        <form action={createBookingRequest} className="grid gap-4 md:grid-cols-3">
          {selectors}
          <Field
            label="Charge units"
            name="units"
            type="number"
            min="1"
            max="365"
            defaultValue="1"
            required
          />
          <Field label="Discount code (optional)" name="coupon" />
          <div className="self-end">
            <Button type="submit">Validate and create</Button>
          </div>
        </form>
      </Card>
      <Card
        title="Join the waitlist"
        description="Use when requested capacity is unavailable. Waitlist placement never guarantees a reservation or price."
      >
        <form action={createWaitlistEntry} className="grid gap-4 md:grid-cols-3">
          {selectors}
          <Field
            label="Flexible by days"
            name="flexibilityDays"
            type="number"
            min="0"
            max="30"
            defaultValue="0"
            required
          />
          <div className="self-end">
            <Button type="submit" variant="secondary">
              Create waitlist entry
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
