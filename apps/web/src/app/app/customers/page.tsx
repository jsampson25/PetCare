import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { PageHeader } from '@petcare/ui/page-header';
import { RecordList, RecordListItem } from '@petcare/ui/record-list';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
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
      <PageHeader
        description="Create the customer relationship and first pet record used by booking and care."
        eyebrow="Customer records"
        title="Customers and households"
      />
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
        <Card className="overflow-hidden !p-0">
          <div className="bg-[linear-gradient(135deg,#edf6f0,#fff)] px-6 py-5">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--action-primary)]">
              New household
            </p>
            <h2 className="mt-1 text-xl font-black">Add a customer and first dog</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create the relationship and care profile together.
            </p>
          </div>
          <form action={createCustomerHouseholdWithPet} className="grid gap-5 p-6 lg:grid-cols-2">
            <fieldset className="grid gap-5 rounded-2xl border border-[var(--border-default)] p-5 sm:grid-cols-2">
              <legend className="px-2 text-lg font-bold">1 · Customer</legend>
              <Field label="First name" name="firstName" required />
              <Field label="Last name" name="lastName" required />
              <Field label="Preferred name (optional)" name="preferredName" />
              <Field autoComplete="email" label="Email" name="email" required type="email" />
              <Field autoComplete="tel" label="Phone" name="phone" required type="tel" />
            </fieldset>
            <fieldset className="grid gap-5 rounded-2xl border border-[var(--border-default)] p-5 sm:grid-cols-2">
              <legend className="px-2 text-lg font-bold">2 · First dog</legend>
              <Field label="Pet name" name="petName" required />
              <Field label="Breed or mix" name="breed" required />
              <Field
                label="Birth date (optional)"
                max={new Date().toISOString().slice(0, 10)}
                name="birthDate"
                type="date"
              />
              <SelectField label="Sex" name="petSex">
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="unknown">Unknown</option>
              </SelectField>
              <label className="flex min-h-12 items-center gap-3 text-sm font-bold sm:col-span-2">
                <input className="size-5" name="birthDateEstimated" type="checkbox" />
                Birth date is estimated
              </label>
            </fieldset>
            <div className="lg:col-span-2">
              <Button type="submit">Create customer and pet</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card title={`Customers (${customers?.length ?? 0})`}>
        {customers?.length ? (
          <RecordList>
            {customers.map((customer) => (
              <RecordListItem
                action={
                  <ButtonLink href={`/app/customers/${customer.id}`} variant="secondary">
                    View household
                  </ButtonLink>
                }
                description={
                  <>
                    {customer.preferred_name ? (
                      <span className="block">
                        Legal name: {customer.first_name} {customer.last_name}
                      </span>
                    ) : null}
                    <span className="block">
                      {customer.email} · {customer.phone}
                    </span>
                  </>
                }
                key={customer.id}
                status={
                  <Badge tone={customer.status === 'active' ? 'success' : 'info'}>
                    {customer.status}
                  </Badge>
                }
                title={
                  <>
                    {customer.preferred_name || customer.first_name} {customer.last_name}
                  </>
                }
              />
            ))}
          </RecordList>
        ) : (
          <StatePanel
            description="Add the first customer and pet with the household form above."
            size="compact"
            title="No customer records yet"
          />
        )}
      </Card>
    </div>
  );
}
