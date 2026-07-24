import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  deleteLocationClosure,
  saveLocationClosure,
  saveLocationCustomerWindows,
  saveOnboardingSetup,
} from '../actions';
import { AddressAutocomplete } from './address-autocomplete';

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
  const [
    { data: business },
    { data: locations },
    { data: readinessRows },
    { data: customerWindows },
    { data: closures },
    { data: claimsData },
  ] = await Promise.all([
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
    supabase
      .from('location_customer_windows')
      .select('location_id,window_type,day_of_week,starts_at,ends_at,is_closed')
      .eq('business_id', context.businessId)
      .eq('day_of_week', 1),
    supabase
      .from('location_closures')
      .select('id,location_id,closure_date,reason,customer_message')
      .eq('business_id', context.businessId)
      .gte('closure_date', new Date().toISOString().slice(0, 10))
      .order('closure_date')
      .limit(12),
    supabase.auth.getClaims(),
  ]);
  const location = locations?.[0];
  if (!business || !location) redirect('/denied');
  const readiness = readinessRows?.[0];
  const arrivalWindow = customerWindows?.find(
    (window) => window.location_id === location.id && window.window_type === 'arrival',
  );
  const pickupWindow = customerWindows?.find(
    (window) => window.location_id === location.id && window.window_type === 'pickup',
  );
  const locationClosures = closures?.filter((closure) => closure.location_id === location.id) ?? [];
  const registeredEmail =
    typeof claimsData?.claims?.email === 'string' ? claimsData.claims.email : '';
  const rawCompletion = readiness?.completion_percent ?? 0;
  const setupProgress = Math.min(100, Math.max(15, Math.round(15 + rawCompletion * 0.85)));

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] bg-[#0b1f3a] p-7 text-white shadow-[0_24px_70px_rgba(11,31,58,.2)] sm:p-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#2563eb]/30 blur-2xl" />
        <p className="relative text-xs font-black uppercase tracking-[0.18em] text-[#7dd3fc]">
          Business setup
        </p>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-[-.04em]">
          Business and first location
        </h1>
        <p className="relative mt-2 text-white/70">
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
        className="overflow-hidden border-[#dbe7f5]"
        title={`Setup progress: ${setupProgress}%`}
        description="Your account is ready. Complete the business, location, and hours details below."
      >
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--action-primary)]"
            style={{ width: `${setupProgress}%` }}
          />
        </div>
        <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-xl bg-[#e8f7ef] p-3 font-bold text-[#12643f]">
            ✓ Account created
          </li>
          <li className="rounded-xl bg-[var(--surface-subtle)] p-3 font-bold">
            {readiness?.business_profile_complete ? '✓' : '○'} Business profile
          </li>
          <li className="rounded-xl bg-[var(--surface-subtle)] p-3 font-bold">
            {readiness?.location_profile_complete ? '✓' : '○'} Location profile
          </li>
          <li className="rounded-xl bg-[var(--surface-subtle)] p-3 font-bold">
            {readiness?.operating_hours_complete ? '✓' : '○'} Operating hours
          </li>
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
              defaultValue={business.customer_email || registeredEmail}
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
            <AddressAutocomplete apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
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
              This first slice uses one Monday-Friday schedule with Saturday and Sunday closed.
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
      <Card
        title="Customer arrival and pickup windows"
        description="Choose when customers may drop off and collect pets on weekdays. These times must fit inside regular operating hours."
      >
        <form action={saveLocationCustomerWindows} className="space-y-6">
          <input name="locationId" type="hidden" value={location.id} />
          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset className="grid gap-4 rounded-2xl border border-[var(--border-default)] p-5 sm:grid-cols-2">
              <legend className="px-2 text-base font-bold">Arrival window</legend>
              <Field
                defaultValue={formatDatabaseTime(arrivalWindow?.starts_at, '07:00')}
                label="Starts"
                name="arrivalStart"
                required
                type="time"
              />
              <Field
                defaultValue={formatDatabaseTime(arrivalWindow?.ends_at, '10:00')}
                label="Ends"
                name="arrivalEnd"
                required
                type="time"
              />
            </fieldset>
            <fieldset className="grid gap-4 rounded-2xl border border-[var(--border-default)] p-5 sm:grid-cols-2">
              <legend className="px-2 text-base font-bold">Pickup window</legend>
              <Field
                defaultValue={formatDatabaseTime(pickupWindow?.starts_at, '16:00')}
                label="Starts"
                name="pickupStart"
                required
                type="time"
              />
              <Field
                defaultValue={formatDatabaseTime(pickupWindow?.ends_at, '19:00')}
                label="Ends"
                name="pickupEnd"
                required
                type="time"
              />
            </fieldset>
          </div>
          <Button type="submit">Save customer windows</Button>
        </form>
      </Card>
      <Card
        title="Upcoming closures"
        description="Block booking on holidays, maintenance days, or other dates when this location cannot accept customers."
      >
        <form action={saveLocationClosure} className="grid gap-5 sm:grid-cols-2">
          <input name="locationId" type="hidden" value={location.id} />
          <Field
            label="Closure date"
            min={new Date().toISOString().slice(0, 10)}
            name="closureDate"
            required
            type="date"
          />
          <Field
            label="Internal reason"
            maxLength={200}
            name="reason"
            placeholder="Holiday or facility maintenance"
            required
          />
          <Field
            className="sm:col-span-2"
            hint="Optional message shown to customers when the date is unavailable."
            label="Customer message"
            maxLength={500}
            name="customerMessage"
          />
          <div className="sm:col-span-2">
            <Button type="submit">Add closure</Button>
          </div>
        </form>
        <div className="mt-6 border-t border-[var(--border-default)] pt-5">
          <h3 className="font-bold">Scheduled dates</h3>
          {locationClosures.length ? (
            <ul className="mt-3 divide-y divide-[var(--border-default)]">
              {locationClosures.map((closure) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                  key={closure.id}
                >
                  <div>
                    <p className="font-bold">{formatClosureDate(closure.closure_date)}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{closure.reason}</p>
                    {closure.customer_message ? (
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Customer message: {closure.customer_message}
                      </p>
                    ) : null}
                  </div>
                  <form action={deleteLocationClosure}>
                    <input name="closureId" type="hidden" value={closure.id} />
                    <Button type="submit" variant="quiet">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No upcoming closures have been added.
            </p>
          )}
        </div>
      </Card>
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#c9dcf7] bg-[#f5f9ff] p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-bold text-[#0b1f3a]">Ready for the next step?</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Continue to add the services customers can book and the prices they will see.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--action-primary)] px-5 py-2.5 text-sm font-bold text-[var(--action-primary-text)] transition hover:bg-[var(--action-primary-hover)] active:translate-y-px active:scale-[0.99]"
          href="/app/settings/services?onboarding=1"
        >
          Continue to services and pricing →
        </Link>
      </div>
    </div>
  );
}

function formatDatabaseTime(value: string | null | undefined, fallback: string) {
  return value?.slice(0, 5) ?? fallback;
}

function formatClosureDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
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
