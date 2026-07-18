import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createCustomerHouseholdWithPet } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('customers.view')) redirect('/denied');
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : undefined;
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id,first_name,last_name,preferred_name,email,phone,status,created_at')
    .eq('business_id', context.businessId)
    .order('last_name')
    .order('first_name')
    .limit(100);
  const canCreate =
    context.permissions.has('customers.manage') && context.permissions.has('pets.manage_care');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Customer records</p>
        <h1 className="text-3xl font-black tracking-tight">Customers and households</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Create the customer relationship and first pet record used by booking and care.
        </p>
      </header>
      {error ? (
        <Alert title="Customer not created" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert title="Customer created" tone="success">
          {notice}
        </Alert>
      ) : null}
      {canCreate ? (
        <Card
          title="Add a customer and first dog"
          description="This creates one customer, their household, and the first pet together. More household members and pets come next."
        >
          <form action={createCustomerHouseholdWithPet} className="space-y-7">
            <fieldset className="grid gap-5 sm:grid-cols-2">
              <legend className="col-span-full text-lg font-bold">Customer</legend>
              <Field label="First name" name="firstName" required />
              <Field label="Last name" name="lastName" required />
              <Field label="Preferred name (optional)" name="preferredName" />
              <Field autoComplete="email" label="Email" name="email" required type="email" />
              <Field autoComplete="tel" label="Phone" name="phone" required type="tel" />
            </fieldset>
            <fieldset className="grid gap-5 sm:grid-cols-2">
              <legend className="col-span-full text-lg font-bold">First dog</legend>
              <Field label="Pet name" name="petName" required />
              <Field label="Breed or mix" name="breed" required />
              <Field
                label="Birth date (optional)"
                max={new Date().toISOString().slice(0, 10)}
                name="birthDate"
                type="date"
              />
              <SelectField
                label="Sex"
                name="petSex"
                options={[
                  ['female', 'Female'],
                  ['male', 'Male'],
                  ['unknown', 'Unknown'],
                ]}
              />
              <label className="flex min-h-12 items-center gap-3 text-sm font-bold sm:col-span-2">
                <input className="size-5" name="birthDateEstimated" type="checkbox" />
                Birth date is estimated
              </label>
            </fieldset>
            <Button type="submit">Create customer and pet</Button>
          </form>
        </Card>
      ) : null}
      <Card title={`Customers (${customers?.length ?? 0})`}>
        {customers?.length ? (
          <ul className="divide-y divide-[var(--border-default)]">
            {customers.map((customer) => (
              <li
                className="grid gap-1 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-5"
                key={customer.id}
              >
                <div>
                  <p className="font-bold">
                    {customer.preferred_name || customer.first_name} {customer.last_name}
                  </p>
                  {customer.preferred_name ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Legal name: {customer.first_name} {customer.last_name}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  <p>{customer.email}</p>
                  <p>{customer.phone}</p>
                </div>
                <span className="text-sm font-semibold capitalize">{customer.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No customer records yet. Add the first customer above.
          </p>
        )}
      </Card>
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={name}>
        {label}
      </label>
      <select
        className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
        id={name}
        name={name}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
