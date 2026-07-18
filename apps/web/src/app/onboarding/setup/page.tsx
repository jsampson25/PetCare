import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { saveOnboardingSetup } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function OnboardingSetupPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/onboarding');
  if (context.requiresMfa && context.sessionAssuranceLevel !== 'aal2')
    redirect('/auth/mfa?next=/onboarding/setup');
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : undefined;
  const supabase = await createSupabaseServerClient();
  const [{ data: business }, { data: locations }, { data: readinessRows }] = await Promise.all([
    supabase
      .from('businesses')
      .select(
        'name,legal_name,customer_email,customer_phone,country_code,locale,currency_code,default_time_zone',
      )
      .eq('id', context.businessId)
      .maybeSingle(),
    supabase
      .from('locations')
      .select(
        'id,name,customer_email,customer_phone,address_line_1,address_line_2,city,region,postal_code,country_code,time_zone',
      )
      .eq('business_id', context.businessId)
      .order('created_at')
      .limit(1),
    supabase.rpc('get_business_setup_readiness', { target_business_id: context.businessId }),
  ]);
  const location = locations?.[0];
  if (!business || !location) redirect('/denied');
  const readiness = readinessRows?.[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Business setup</p>
        <h1 className="text-3xl font-black tracking-tight">Business and first location</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Complete these basics before adding services, capacity, and pricing.
        </p>
      </header>
      {error ? (
        <Alert title="Setup not saved" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert title="Progress saved" tone="success">
          {notice}
        </Alert>
      ) : null}
      <Card
        title={`Foundation readiness: ${readiness?.completion_percent ?? 0}%`}
        description={`${readiness?.completed_steps ?? 0} of ${readiness?.total_steps ?? 3} initial sections complete.`}
      >
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          <li>{readiness?.business_profile_complete ? '✓' : '○'} Business profile</li>
          <li>{readiness?.location_profile_complete ? '✓' : '○'} Location profile</li>
          <li>{readiness?.operating_hours_complete ? '✓' : '○'} Operating hours</li>
        </ul>
      </Card>
      <Card title="Setup details">
        <form action={saveOnboardingSetup} className="space-y-8">
          <input name="locationId" type="hidden" value={location.id} />
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full text-lg font-bold">Business profile</legend>
            <Field
              defaultValue={business.legal_name ?? business.name}
              label="Legal business name"
              name="legalName"
              required
            />
            <Field
              autoComplete="email"
              defaultValue={business.customer_email ?? ''}
              label="Customer email"
              name="customerEmail"
              required
              type="email"
            />
            <Field
              autoComplete="tel"
              defaultValue={business.customer_phone ?? ''}
              label="Customer phone"
              name="customerPhone"
              required
              type="tel"
            />
            <SelectField
              defaultValue={business.country_code}
              label="Country"
              name="countryCode"
              options={[
                ['US', 'United States'],
                ['CA', 'Canada'],
              ]}
            />
            <SelectField
              defaultValue={business.locale}
              label="Locale"
              name="locale"
              options={[
                ['en-US', 'English (United States)'],
                ['en-CA', 'English (Canada)'],
              ]}
            />
            <SelectField
              defaultValue={business.currency_code}
              label="Currency"
              name="currencyCode"
              options={[
                ['USD', 'USD'],
                ['CAD', 'CAD'],
              ]}
            />
          </fieldset>
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full text-lg font-bold">{location.name}</legend>
            <Field
              autoComplete="address-line1"
              className="sm:col-span-2"
              defaultValue={location.address_line_1 ?? ''}
              label="Street address"
              name="addressLine1"
              required
            />
            <Field
              autoComplete="address-line2"
              className="sm:col-span-2"
              defaultValue={location.address_line_2 ?? ''}
              label="Address line 2 (optional)"
              name="addressLine2"
            />
            <Field
              autoComplete="address-level2"
              defaultValue={location.city ?? ''}
              label="City"
              name="city"
              required
            />
            <Field
              autoComplete="address-level1"
              defaultValue={location.region ?? ''}
              label="State or province"
              name="region"
              required
            />
            <Field
              autoComplete="postal-code"
              defaultValue={location.postal_code ?? ''}
              label="Postal code"
              name="postalCode"
              required
            />
            <TimeZoneField defaultValue={location.time_zone || business.default_time_zone} />
          </fieldset>
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full text-lg font-bold">Regular hours</legend>
            <p className="col-span-full text-sm text-[var(--text-secondary)]">
              This first slice uses one Monday–Friday schedule with Saturday and Sunday closed.
              Detailed daily editing comes with calendar configuration.
            </p>
            <Field
              defaultValue="07:00"
              label="Weekday opening"
              name="weekdayOpen"
              required
              type="time"
            />
            <Field
              defaultValue="19:00"
              label="Weekday closing"
              name="weekdayClose"
              required
              type="time"
            />
          </fieldset>
          <Button type="submit">Save setup progress</Button>
        </form>
      </Card>
    </div>
  );
}

function SelectField({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
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
        defaultValue={defaultValue}
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

function TimeZoneField({ defaultValue }: { defaultValue: string }) {
  return (
    <SelectField
      defaultValue={defaultValue}
      label="Time zone"
      name="timeZone"
      options={[
        ['America/New_York', 'Eastern'],
        ['America/Chicago', 'Central'],
        ['America/Denver', 'Mountain'],
        ['America/Phoenix', 'Arizona'],
        ['America/Los_Angeles', 'Pacific'],
        ['America/Anchorage', 'Alaska'],
        ['Pacific/Honolulu', 'Hawaii'],
      ]}
    />
  );
}
