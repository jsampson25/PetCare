import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { notFound, redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { addPetToCustomerHousehold, revokeCustomerPortalAccess } from './actions';
import { PortalInvitationForm } from './portal-invitation-form';

type PageParameters = Promise<{ customerId: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomerHouseholdPage({
  params,
  searchParams,
}: {
  params: PageParameters;
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('customers.view')) redirect('/denied');

  const { customerId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id,first_name,last_name,preferred_name,email,phone,status')
    .eq('business_id', context.businessId)
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) notFound();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id,role')
    .eq('business_id', context.businessId)
    .eq('customer_id', customerId)
    .maybeSingle();
  const [{ data: household }, { data: pets }, { data: portalAccess }, { data: portalInvitations }] =
    membership
      ? await Promise.all([
          supabase
            .from('households')
            .select('id,display_name,status')
            .eq('business_id', context.businessId)
            .eq('id', membership.household_id)
            .maybeSingle(),
          supabase
            .from('pets')
            .select('id,name,breed,birth_date,birth_date_is_estimated,sex,status')
            .eq('business_id', context.businessId)
            .eq('household_id', membership.household_id)
            .order('name'),
          supabase
            .from('customer_portal_access')
            .select('id,status,granted_at')
            .eq('business_id', context.businessId)
            .eq('customer_id', customerId)
            .maybeSingle(),
          supabase
            .from('customer_portal_invitations')
            .select('id,state,expires_at,created_at')
            .eq('business_id', context.businessId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(1),
        ])
      : [{ data: null }, { data: [] }, { data: null }, { data: [] }];

  const error = typeof query.error === 'string' ? query.error : undefined;
  const notice = typeof query.notice === 'string' ? query.notice : undefined;
  const canAddPet = context.permissions.has('pets.manage_care') && Boolean(household);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <ButtonLink href="/app/customers" variant="secondary">
          Back to customers
        </ButtonLink>
        <div>
          <p className="text-sm font-bold text-[var(--action-primary)]">Customer household</p>
          <h1 className="text-3xl font-black tracking-tight">
            {customer.preferred_name || customer.first_name} {customer.last_name}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            {household?.display_name || 'Household unavailable'} · {customer.email} ·{' '}
            {customer.phone}
          </p>
        </div>
      </header>
      {error ? (
        <Alert title="Pet not added" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert title="Household updated" tone="success">
          {notice}
        </Alert>
      ) : null}
      <Card
        title={`Pets (${pets?.length ?? 0})`}
        description="Dogs connected to this customer household."
      >
        {pets?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {pets.map((pet) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={pet.id}
              >
                <p className="text-lg font-bold">{pet.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {pet.breed} · {pet.sex}
                </p>
                <p className="mt-2 text-sm">
                  {pet.birth_date
                    ? `Born ${pet.birth_date_is_estimated ? 'about ' : ''}${formatDate(pet.birth_date)}`
                    : 'Birth date not provided'}
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">{pet.status}</p>
                <div className="mt-4">
                  <ButtonLink href={`/app/pets/${pet.id}`} variant="secondary">
                    Vaccinations
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No pets are connected to this household.
          </p>
        )}
      </Card>
      {context.permissions.has('customers.manage') ? (
        <Card
          title="Customer portal access"
          description="Portal authority is separate from pickup and emergency-contact authority."
        >
          {portalAccess?.status === 'active' ? (
            <div className="space-y-4">
              <Alert title="Portal access active" tone="success">
                Granted{' '}
                {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                  new Date(portalAccess.granted_at),
                )}
              </Alert>
              <form
                action={revokeCustomerPortalAccess}
                className="grid gap-3 sm:grid-cols-[1fr_auto]"
              >
                <input name="customerId" type="hidden" value={customer.id} />
                <Field label="Revocation reason" name="reason" required />
                <Button type="submit" variant="secondary">
                  Revoke access
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <PortalInvitationForm customerId={customer.id} />
              {portalInvitations?.[0]?.state === 'pending' ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  A pending invitation expires{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(portalInvitations[0].expires_at))}
                  . Creating another supersedes it.
                </p>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}
      {canAddPet ? (
        <Card title="Add another dog" description="Create another pet under the same household.">
          <form action={addPetToCustomerHousehold} className="grid gap-5 sm:grid-cols-2">
            <input name="customerId" type="hidden" value={customer.id} />
            <Field label="Pet name" name="petName" required />
            <Field label="Breed or mix" name="breed" required />
            <Field
              label="Birth date (optional)"
              max={new Date().toISOString().slice(0, 10)}
              name="birthDate"
              type="date"
            />
            <SelectField name="petSex" />
            <label className="flex min-h-12 items-center gap-3 text-sm font-bold sm:col-span-2">
              <input className="size-5" name="birthDateEstimated" type="checkbox" />
              Birth date is estimated
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Add pet</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function SelectField({ name }: { name: string }) {
  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={name}>
        Sex
      </label>
      <select
        className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
        id={name}
        name={name}
      >
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="unknown">Unknown</option>
      </select>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
