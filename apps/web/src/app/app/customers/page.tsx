import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Field } from '@petcare/ui/field';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { RecordList, RecordListItem } from '@petcare/ui/record-list';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createCustomerHouseholdWithPet } from './actions';
import {
  type CustomerHousehold,
  filterCustomerDirectory,
  summarizeCustomerHousehold,
} from './customer-directory';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('customers.view')) redirect('/denied');
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : undefined;
  const query = typeof parameters.q === 'string' ? parameters.q.trim() : '';
  const status = typeof parameters.status === 'string' ? parameters.status : 'active';
  const supabase = await createSupabaseServerClient();
  let customerQuery = supabase
    .from('customers')
    .select('id,first_name,last_name,preferred_name,email,phone,status,created_at')
    .eq('business_id', context.businessId)
    .order('last_name')
    .order('first_name')
    .limit(100);
  if (status !== 'all') customerQuery = customerQuery.eq('status', status);
  const { data: customerRecords } = await customerQuery;
  const customers = filterCustomerDirectory(customerRecords ?? [], query);
  const { data: memberships } = customers.length
    ? await supabase
        .from('household_members')
        .select('customer_id,household_id,households(display_name,pets(name,status))')
        .eq('business_id', context.businessId)
        .in(
          'customer_id',
          customers.map((customer) => customer.id),
        )
    : { data: [] };
  const householdsByCustomer = new Map(
    (memberships ?? []).map((membership) => [
      membership.customer_id,
      membership.households as unknown as CustomerHousehold,
    ]),
  );
  const householdCount = new Set((memberships ?? []).map((membership) => membership.household_id))
    .size;
  const householdSummaries = customers.map((customer) =>
    summarizeCustomerHousehold(householdsByCustomer.get(customer.id) ?? null),
  );
  const activePetCount = householdSummaries.reduce(
    (total, household) => total + household.activePetCount,
    0,
  );
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
      <CommandBar
        description="Search contact and household relationships, then narrow by customer lifecycle."
        title="Find customers"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <Field
            defaultValue={query}
            density="compact"
            label="Name, email, or phone"
            name="q"
            placeholder="Pat Morgan or 615-555-0101"
          />
          <SelectField defaultValue={status} density="compact" label="Status" name="status">
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="inactive">Inactive</option>
            <option value="restricted">Restricted</option>
            <option value="archived">Archived</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      {canCreate ? (
        <Card
          description="Create the relationship and care profile together."
          eyebrow="New household"
          title="Add a customer and first dog"
          tone="accent"
        >
          <form action={createCustomerHouseholdWithPet} className="grid gap-5 lg:grid-cols-2">
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
              <Button leadingIcon={<Icon name="add" />} type="submit">
                Create customer and pet
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card eyebrow="Directory summary" title="Current view" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Customers</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{customers.length}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Households</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{householdCount}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Active pets</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{activePetCount}</dd>
          </div>
        </dl>
      </Card>
      <Card
        actions={<Badge tone="info">{customers?.length ?? 0} records</Badge>}
        description="Customer identities, contact details, account status, and household access."
        eyebrow="Customer directory"
        title="Customers"
      >
        {customers?.length ? (
          <RecordList>
            {customers.map((customer) => {
              const household = summarizeCustomerHousehold(
                householdsByCustomer.get(customer.id) ?? null,
              );
              return (
                <RecordListItem
                  action={
                    <ButtonLink
                      href={`/app/customers/${customer.id}`}
                      leadingIcon={<Icon name="arrow-right" />}
                      variant="secondary"
                    >
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
                      <span className="block font-semibold text-[var(--text-primary)]">
                        {household.displayName} ·{' '}
                        {household.petNames.length
                          ? household.petNames.join(', ')
                          : 'No active pets'}
                      </span>
                    </>
                  }
                  key={customer.id}
                  leading={
                    <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)] text-[var(--action-primary)]">
                      <Icon name="users" />
                    </span>
                  }
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
              );
            })}
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
