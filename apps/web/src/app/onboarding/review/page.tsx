import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { launchBusiness } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' });

export default async function OnboardingReviewPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/sign-in');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [
    { data: business },
    { data: locations },
    { data: setupReadiness },
    { data: services },
    { data: versions },
    { data: pools },
    { data: priceVersions },
    { data: policies },
    { data: rates },
    { data: website },
    { data: websiteReadiness },
  ] = await Promise.all([
    supabase
      .from('businesses')
      .select('name,legal_name,customer_email,customer_phone,public_slug,status')
      .eq('id', context.businessId)
      .single(),
    supabase
      .from('locations')
      .select('id,name,address_line_1,city,region,postal_code,time_zone,status')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('created_at'),
    supabase.rpc('get_business_setup_readiness', { target_business_id: context.businessId }),
    supabase
      .from('services')
      .select('id,category,internal_name,status')
      .eq('business_id', context.businessId)
      .order('display_order'),
    supabase
      .from('service_versions')
      .select('id,service_id,customer_name,status,version_number')
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
    supabase
      .from('capacity_pools')
      .select('service_id,configured_capacity,status')
      .eq('business_id', context.businessId)
      .eq('status', 'active'),
    supabase
      .from('price_book_versions')
      .select('id,status,version_number')
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
    supabase
      .from('commercial_policy_versions')
      .select(
        'id,status,name,deposit_type,deposit_value,cancellation_notice_hours,customer_summary',
      )
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
    supabase
      .from('price_rate_rules')
      .select('price_book_version_id,service_version_id,charge_unit,amount_minor,label')
      .eq('business_id', context.businessId),
    supabase
      .from('tenant_websites')
      .select('status,theme_key,current_publication_number')
      .eq('business_id', context.businessId)
      .maybeSingle(),
    supabase.schema('app').rpc('get_tenant_website_readiness', {
      target_business_id: context.businessId,
    }),
  ]);

  const latestVersionByService = new Map<string, NonNullable<typeof versions>[number]>();
  for (const version of versions ?? []) {
    if (!latestVersionByService.has(version.service_id)) {
      latestVersionByService.set(version.service_id, version);
    }
  }
  const capacityByService = new Map(
    (pools ?? []).map((pool) => [pool.service_id, pool.configured_capacity]),
  );
  const currentPriceVersion = priceVersions?.[0];
  const currentPolicy = policies?.[0];
  const currentRates = (rates ?? []).filter(
    (rate) => rate.price_book_version_id === currentPriceVersion?.id,
  );
  const readiness = setupReadiness?.[0];
  const websiteChecks = (websiteReadiness ?? {}) as Record<string, boolean>;
  const profileReady = Boolean(
    readiness?.business_profile_complete &&
    readiness.location_profile_complete &&
    readiness.operating_hours_complete,
  );
  const servicesReady =
    Boolean(services?.length) &&
    (services ?? []).every(
      (service) => latestVersionByService.has(service.id) && capacityByService.has(service.id),
    );
  const pricingReady = Boolean(
    currentPriceVersion?.status === 'draft' &&
    currentPolicy?.status === 'draft' &&
    currentRates.length,
  );
  const websiteReady = ['hero', 'about', 'faq', 'contact', 'brand'].every(
    (key) => websiteChecks[key],
  );
  const launchReady = profileReady && servicesReady && pricingReady && websiteReady;
  const launched = parameters.launched === '1' || business?.status === 'active';
  const publicSlug =
    typeof parameters.site === 'string' ? parameters.site : (business?.public_slug ?? '');

  if (launched) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
        <section className="overflow-hidden rounded-[2rem] border border-[#bfd7fb] bg-white shadow-[0_28px_80px_rgba(37,99,235,.14)]">
          <div className="bg-gradient-to-br from-[#eaf3ff] via-white to-[#dff6ff] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2563eb] text-3xl text-white">
              ✓
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#2563eb]">
              Your business is live
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-.04em] text-[#0b1f3a]">
              Welcome to Roventra, {business?.name}.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#526984]">
              Your services, pricing, capacity, and customer website are published. You can keep
              refining them at any time.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2563eb] px-6 font-bold text-white hover:bg-[#1d4ed8]"
                href="/app"
              >
                Open my dashboard
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#b9d0ef] bg-white px-6 font-bold text-[#123057] hover:bg-[#f5f9ff]"
                href={`/site/${publicSlug}`}
                target="_blank"
              >
                View my live website
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2563eb]">
            Guided setup · Final step
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#0b1f3a]">
            Review everything before launch.
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#526984]">
            Nothing is public until you launch. Review the customer-facing details and fix anything
            that still needs attention.
          </p>
        </div>
        <div className="min-w-48">
          <div className="flex justify-between text-xs font-bold text-[#48617f]">
            <span>Setup progress</span>
            <span>{launchReady ? '100%' : '90%'}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
            <div
              className={`h-full rounded-full bg-[#2563eb] ${launchReady ? 'w-full' : 'w-[90%]'}`}
            />
          </div>
        </div>
      </header>

      {typeof parameters.error === 'string' ? (
        <div className="mt-6">
          <Alert title="Launch could not be completed" tone="danger">
            {parameters.error}
          </Alert>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <ReviewSection
            editHref="/onboarding/setup"
            ready={profileReady}
            title="Business and location"
          >
            <p className="font-black text-[#0b1f3a]">{business?.legal_name ?? business?.name}</p>
            <p>{business?.customer_email}</p>
            <p>{business?.customer_phone}</p>
            {locations?.[0] ? (
              <p>
                {locations[0].address_line_1}, {locations[0].city}, {locations[0].region}{' '}
                {locations[0].postal_code}
              </p>
            ) : null}
          </ReviewSection>

          <ReviewSection
            editHref="/app/settings/services?onboarding=1"
            ready={servicesReady}
            title="Services and capacity"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(services ?? []).map((service) => (
                <div className="rounded-xl bg-[#f4f8fe] p-4" key={service.id}>
                  <p className="font-black text-[#0b1f3a]">
                    {latestVersionByService.get(service.id)?.customer_name ?? service.internal_name}
                  </p>
                  <p className="mt-1 text-sm">
                    Capacity: {capacityByService.get(service.id) ?? 'Not set'}
                  </p>
                </div>
              ))}
            </div>
          </ReviewSection>

          <ReviewSection
            editHref="/app/settings/pricing?onboarding=1"
            ready={pricingReady}
            title="Pricing and policies"
          >
            <div className="space-y-3">
              {currentRates.map((rate) => {
                const serviceVersion = (versions ?? []).find(
                  (version) => version.id === rate.service_version_id,
                );
                return (
                  <div className="flex items-center justify-between gap-4" key={rate.label}>
                    <span>{serviceVersion?.customer_name ?? rate.label}</span>
                    <strong className="text-[#0b1f3a]">
                      {money.format(rate.amount_minor / 100)} /{' '}
                      {rate.charge_unit.replaceAll('_', ' ')}
                    </strong>
                  </div>
                );
              })}
              <div className="border-t border-[#dbe7f5] pt-3 text-sm">
                <p>
                  Deposit: {currentPolicy?.deposit_type ?? 'Not set'}{' '}
                  {currentPolicy?.deposit_value ?? ''}
                </p>
                <p>
                  Cancellation notice: {currentPolicy?.cancellation_notice_hours ?? 'Not set'} hours
                </p>
              </div>
            </div>
          </ReviewSection>

          <ReviewSection
            editHref="/app/settings/website"
            ready={websiteReady}
            title="Customer website"
          >
            <p>
              Theme: <strong className="capitalize text-[#0b1f3a]">{website?.theme_key}</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['hero', 'about', 'faq', 'contact', 'brand'].map((check) => (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    websiteChecks[check]
                      ? 'bg-[#e5f7ee] text-[#14724a]'
                      : 'bg-[#fff1ef] text-[#a43a2d]'
                  }`}
                  key={check}
                >
                  {websiteChecks[check] ? '✓' : '○'} {check}
                </span>
              ))}
            </div>
            <Link
              className="mt-4 inline-flex font-bold text-[#2563eb] hover:underline"
              href="/app/settings/website/preview"
              target="_blank"
            >
              Open website preview ↗
            </Link>
          </ReviewSection>
        </div>

        <aside className="h-fit rounded-[2rem] border border-[#bfd7fb] bg-gradient-to-br from-[#edf5ff] via-white to-[#e7f8ff] p-6 shadow-[0_20px_60px_rgba(37,99,235,.1)] lg:sticky lg:top-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">
            Launch checklist
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#0b1f3a]">
            {launchReady ? 'Ready to welcome customers' : 'A few details still need attention'}
          </h2>
          <div className="mt-5 space-y-3">
            <ReadinessRow label="Business profile" ready={profileReady} />
            <ReadinessRow label="Services and capacity" ready={servicesReady} />
            <ReadinessRow label="Pricing and policies" ready={pricingReady} />
            <ReadinessRow label="Customer website" ready={websiteReady} />
          </div>
          <form action={launchBusiness} className="mt-6">
            <Button className="w-full" disabled={!launchReady} type="submit">
              Launch my business
            </Button>
          </form>
          {!launchReady ? (
            <p className="mt-3 text-center text-xs leading-5 text-[#61758e]">
              Complete the items marked “Needs attention” to enable launch.
            </p>
          ) : (
            <p className="mt-3 text-center text-xs leading-5 text-[#61758e]">
              This publishes your website, services, and pricing together.
            </p>
          )}
          <div className="mt-6 border-t border-[#d4e2f4] pt-5">
            <p className="text-sm font-bold text-[#0b1f3a]">Optional next step</p>
            <Link
              className="mt-2 inline-flex text-sm font-bold text-[#2563eb] hover:underline"
              href="/app/settings/staff"
            >
              Invite staff members →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ReviewSection({
  children,
  editHref,
  ready,
  title,
}: {
  children: React.ReactNode;
  editHref: string;
  ready: boolean;
  title: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#d1e0f3] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full font-black ${
              ready ? 'bg-[#e5f7ee] text-[#14724a]' : 'bg-[#fff1ef] text-[#a43a2d]'
            }`}
          >
            {ready ? '✓' : '!'}
          </span>
          <h2 className="text-xl font-black text-[#0b1f3a]">{title}</h2>
        </div>
        <Link className="text-sm font-bold text-[#2563eb] hover:underline" href={editHref}>
          Edit
        </Link>
      </div>
      <div className="space-y-1 text-[#526984]">{children}</div>
    </section>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-bold text-[#243d5c]">{label}</span>
      <span className={`text-xs font-black ${ready ? 'text-[#14724a]' : 'text-[#a43a2d]'}`}>
        {ready ? 'Ready' : 'Needs attention'}
      </span>
    </div>
  );
}
