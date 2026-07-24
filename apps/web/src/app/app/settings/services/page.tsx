import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import {
  addCapacityResource,
  addServiceQuestion,
  addServiceRequirement,
  changeCapacityResourceStatus,
  changeServiceStatus,
  createCapacityPool,
  createServiceDraft,
  createServiceRevision,
  createStarterServices,
  publishService,
  saveCapacityOverride,
} from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.view')) redirect('/denied');
  const parameters = await searchParams;
  const isOnboarding = parameters.onboarding === '1';
  const supabase = await createSupabaseServerClient();
  const [
    { data: services },
    { data: versions },
    { data: locations },
    { data: pools },
    { data: requirements },
    { data: questions },
    { data: resources },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id,category,internal_name,status,display_order')
      .eq('business_id', context.businessId)
      .order('display_order')
      .order('internal_name'),
    supabase
      .from('service_versions')
      .select(
        'id,service_id,version_number,status,customer_name,time_model,default_duration_minutes',
      )
      .eq('business_id', context.businessId)
      .order('version_number', { ascending: false }),
    supabase
      .from('locations')
      .select('id,name')
      .eq('business_id', context.businessId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('capacity_pools')
      .select(
        'id,service_id,location_id,name,capacity_model,configured_capacity,physical_maximum,status',
      )
      .eq('business_id', context.businessId)
      .order('name'),
    supabase
      .from('service_requirements')
      .select('id,service_version_id,requirement_type,requirement_key,enforcement,customer_message')
      .eq('business_id', context.businessId)
      .eq('active', true),
    supabase
      .from('service_booking_questions')
      .select('id,service_version_id,prompt,response_type,required')
      .eq('business_id', context.businessId)
      .eq('active', true),
    supabase
      .from('capacity_resources')
      .select('id,capacity_pool_id,resource_code,label,resource_type,max_pets,status')
      .eq('business_id', context.businessId)
      .order('label'),
  ]);
  const latestByService = new Map<string, NonNullable<typeof versions>[number]>();
  for (const version of versions ?? [])
    if (!latestByService.has(version.service_id)) latestByService.set(version.service_id, version);
  const canManage = context.permissions.has('services.manage');
  const canManageCapacity = context.permissions.has('capacity.manage');
  const draftVersions = (versions ?? []).filter((version) => version.status === 'draft');
  const existingCategories = new Set((services ?? []).map((service) => service.category));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Settings</p>
        <h1 className="text-3xl font-black tracking-tight">Services</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Define what customers can request without mixing catalog identity with pricing or
          capacity.
        </p>
      </header>
      {typeof parameters.error === 'string' ? (
        <Alert title="Service update failed" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {typeof parameters.notice === 'string' ? (
        <Alert title="Service catalog updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {isOnboarding && canManage ? (
        <section className="overflow-hidden rounded-[2rem] border border-[#c9dcf7] bg-white shadow-[0_22px_65px_rgba(37,99,235,.1)]">
          <div className="border-b border-[#dbe7f5] bg-gradient-to-r from-[#eff6ff] via-white to-[#e8f5ff] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">
                  Guided setup · Step 2
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#0b1f3a]">
                  What does your business offer?
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#48617f]">
                  Choose your main services. We will create sensible drafts that you can customize
                  before anything appears to customers.
                </p>
              </div>
              <div className="min-w-40">
                <div className="flex items-center justify-between text-xs font-bold text-[#48617f]">
                  <span>Setup progress</span>
                  <span>45%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
                  <div className="h-full w-[45%] rounded-full bg-[#2563eb]" />
                </div>
              </div>
            </div>
          </div>
          <form action={createStarterServices} className="p-6 sm:p-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  category: 'boarding',
                  description: 'Overnight stays with arrival and pickup windows.',
                  icon: '☾',
                  title: 'Boarding',
                },
                {
                  category: 'daycare',
                  description: 'Day visits with attendance and capacity tracking.',
                  icon: '☀',
                  title: 'Daycare',
                },
                {
                  category: 'grooming',
                  description: 'Scheduled grooming appointments and service work.',
                  icon: '✦',
                  title: 'Grooming',
                },
                {
                  category: 'assessment',
                  description: 'Meet and greets or evaluations before care begins.',
                  icon: '✓',
                  title: 'Assessments',
                },
              ].map((option) => {
                const alreadyExists = existingCategories.has(option.category);
                return (
                  <label
                    className={`relative flex min-h-48 cursor-pointer flex-col rounded-2xl border p-5 transition ${
                      alreadyExists
                        ? 'border-[#b9e3cf] bg-[#f0fbf6]'
                        : 'border-[#c9dcf7] bg-white hover:-translate-y-0.5 hover:border-[#6ca4f8] hover:shadow-lg'
                    }`}
                    key={option.category}
                  >
                    <input
                      className="absolute right-4 top-4 size-5 accent-[#2563eb]"
                      defaultChecked={alreadyExists}
                      disabled={alreadyExists}
                      name="starterServices"
                      type="checkbox"
                      value={option.category}
                    />
                    {alreadyExists ? (
                      <input name="starterServices" type="hidden" value={option.category} />
                    ) : null}
                    <span className="flex size-11 items-center justify-center rounded-xl bg-[#e8f1ff] text-xl font-black text-[#2563eb]">
                      {option.icon}
                    </span>
                    <span className="mt-5 text-lg font-black text-[#0b1f3a]">{option.title}</span>
                    <span className="mt-2 text-sm leading-6 text-[#526984]">
                      {option.description}
                    </span>
                    {alreadyExists ? (
                      <span className="mt-auto pt-4 text-xs font-bold uppercase tracking-[.12em] text-[#14724a]">
                        Already added
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#dbe7f5] pt-6 sm:flex-row sm:items-center">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-[#35506f] hover:bg-[#f1f6fd]"
                href="/onboarding/setup"
              >
                ← Back to business details
              </Link>
              <div className="flex flex-col gap-3 sm:flex-row">
                {(services ?? []).length ? (
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9cce6] bg-white px-5 text-sm font-bold text-[#0b1f3a] hover:bg-[#f5f9ff]"
                    href="/app/settings/pricing?onboarding=1"
                  >
                    Continue to pricing
                  </Link>
                ) : null}
                <Button type="submit">Create selected service drafts</Button>
              </div>
            </div>
          </form>
        </section>
      ) : null}
      {canManage ? (
        <Card
          title={isOnboarding ? 'Advanced service setup' : 'Create a service draft'}
          description={
            isOnboarding
              ? 'Use this when a service needs different scheduling or confirmation behavior.'
              : 'Drafts remain internal until you publish them for a location and channel.'
          }
        >
          <form action={createServiceDraft} className="grid gap-4 md:grid-cols-2">
            <Field label="Internal name" name="internalName" required />
            <Field label="Customer-facing name" name="customerName" required />
            <label className="text-sm font-bold">
              Category
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="category"
                defaultValue="boarding"
              >
                <option value="boarding">Boarding</option>
                <option value="daycare">Daycare</option>
                <option value="grooming">Grooming</option>
                <option value="assessment">Assessment</option>
                <option value="add_on">Add-on</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Time model
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="timeModel"
                defaultValue="overnight_date_range"
              >
                <option value="overnight_date_range">Overnight date range</option>
                <option value="attendance_day">Attendance day</option>
                <option value="fixed_appointment">Fixed appointment</option>
                <option value="flexible_appointment">Flexible appointment</option>
                <option value="add_on">Add-on</option>
              </select>
            </label>
            <Field
              label="Default duration (minutes)"
              name="durationMinutes"
              type="number"
              min="5"
              max="1440"
              hint="Required for appointment services."
            />
            <label className="text-sm font-bold">
              Confirmation
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="confirmationMode"
                defaultValue="instant"
              >
                <option value="instant">Instant</option>
                <option value="staff_approval">Staff approval</option>
                <option value="request_only">Request only</option>
              </select>
            </label>
            <Field
              className="md:col-span-2"
              label="Short description"
              name="shortDescription"
              maxLength={240}
            />
            <div className="md:col-span-2">
              <Button type="submit">Create draft</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {canManage && draftVersions.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card
            title="Add an eligibility requirement"
            description="Requirements produce customer-safe block, review, or warning explanations."
          >
            <form action={addServiceRequirement} className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">
                Draft service version
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="versionId"
                >
                  {draftVersions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.customer_name} · v{version.version_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Requirement type
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="requirementType"
                >
                  <option value="vaccination">Vaccination</option>
                  <option value="daycare_evaluation">Daycare evaluation</option>
                  <option value="minimum_age_months">Minimum age (months)</option>
                  <option value="maximum_weight_kg">Maximum weight (kg)</option>
                  <option value="document">Document/manual review</option>
                </select>
              </label>
              <Field
                label="Rule key"
                name="requirementKey"
                hint="Example: rabies_current"
                required
              />
              <Field
                label="Required value"
                name="comparisonValue"
                hint="Example: rabies, 6, or 45"
                required
              />
              <label className="text-sm font-bold">
                Enforcement
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="enforcement"
                >
                  <option value="block">Block booking</option>
                  <option value="staff_review">Staff review</option>
                  <option value="warn">Warning</option>
                </select>
              </label>
              <Field label="Customer explanation" name="customerMessage" required />
              <div className="md:col-span-2">
                <Button type="submit">Add requirement</Button>
              </div>
            </form>
          </Card>
          <Card
            title="Add a booking question"
            description="Versioned intake questions are answered once for each booking item or pet."
          >
            <form action={addServiceQuestion} className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">
                Draft service version
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="versionId"
                >
                  {draftVersions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.customer_name} · v{version.version_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Response type
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="responseType"
                >
                  <option value="short_text">Short text</option>
                  <option value="long_text">Long text</option>
                  <option value="yes_no">Yes/no</option>
                  <option value="single_select">Single select</option>
                  <option value="multi_select">Multi-select</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                </select>
              </label>
              <Field
                label="Question key"
                name="questionKey"
                hint="Example: pickup_contact"
                required
              />
              <Field label="Customer prompt" name="prompt" required />
              <Field label="Options" name="options" hint="Comma-separated for select questions." />
              <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold">
                <input type="checkbox" name="required" />
                Required answer
              </label>
              <div className="md:col-span-2">
                <Button type="submit">Add question</Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
      {canManageCapacity && (services ?? []).length && locations?.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card
            title="Create a capacity pool"
            description="Configured capacity may never exceed the physical maximum."
          >
            <form action={createCapacityPool} className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">
                Service
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="serviceId"
                >
                  {(services ?? [])
                    .filter((service) => service.status === 'active')
                    .map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.internal_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Location
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="locationId"
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Pool name" name="name" required />
              <label className="text-sm font-bold">
                Capacity model
                <select
                  className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                  name="model"
                >
                  <option value="pet_count">Pet count</option>
                  <option value="service_unit">Service units</option>
                  <option value="named_resource">Named resources</option>
                </select>
              </label>
              <Field
                label="Physical maximum"
                name="physicalMaximum"
                type="number"
                min="1"
                required
              />
              <Field
                label="Sellable capacity"
                name="configuredCapacity"
                type="number"
                min="1"
                required
              />
              <div className="md:col-span-2">
                <Button type="submit">Create capacity pool</Button>
              </div>
            </form>
          </Card>
          <Card
            title="Schedule a capacity override"
            description="Temporarily reduce sellable capacity for staffing or operational constraints."
          >
            {pools?.length ? (
              <form action={saveCapacityOverride} className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold md:col-span-2">
                  Capacity pool
                  <select
                    className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                    name="poolId"
                  >
                    {pools
                      .filter((pool) => pool.status === 'active')
                      .map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.name} · {pool.configured_capacity}/{pool.physical_maximum}
                        </option>
                      ))}
                  </select>
                </label>
                <Field label="Starts" name="startsOn" type="date" required />
                <Field label="Ends" name="endsOn" type="date" required />
                <Field label="Capacity" name="capacity" type="number" min="0" required />
                <Field label="Reason" name="reason" required />
                <div className="md:col-span-2">
                  <Button type="submit">Save override</Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Create a capacity pool first.</p>
            )}
          </Card>
        </div>
      ) : null}
      {canManageCapacity && pools?.length ? (
        <Card
          title="Named resources"
          description="Track kennels, suites, yards, grooming stations, or staff-linked slots inside a capacity pool."
        >
          <form action={addCapacityResource} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">
              Capacity pool
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="poolId"
              >
                {pools
                  .filter((pool) => pool.status === 'active')
                  .map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.name}
                    </option>
                  ))}
              </select>
            </label>
            <Field label="Resource code" name="resourceCode" required />
            <Field label="Display label" name="label" required />
            <label className="text-sm font-bold">
              Resource type
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="resourceType"
              >
                <option value="kennel">Kennel</option>
                <option value="suite">Suite</option>
                <option value="yard">Yard</option>
                <option value="grooming_station">Grooming station</option>
                <option value="staff_slot">Staff slot</option>
                <option value="other">Other</option>
              </select>
            </label>
            <Field
              label="Maximum pets"
              name="maxPets"
              type="number"
              min="1"
              max="20"
              defaultValue="1"
              required
            />
            <div className="self-end">
              <Button type="submit">Add resource</Button>
            </div>
          </form>
          {resources?.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {resources.map((resource) => (
                <div key={resource.id} className="rounded-lg border p-4">
                  <p className="font-bold">
                    {resource.label}{' '}
                    <span className="font-normal text-[var(--text-secondary)]">
                      ({resource.resource_code})
                    </span>
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {resource.resource_type.replaceAll('_', ' ')} · {resource.status} · up to{' '}
                    {resource.max_pets} pets
                  </p>
                  {resource.status !== 'retired' ? (
                    <form action={changeCapacityResourceStatus} className="mt-3 flex gap-2">
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <select
                        className="min-h-11 rounded-lg border bg-white px-3 text-sm"
                        name="status"
                        defaultValue={resource.status === 'ready' ? 'maintenance' : 'ready'}
                      >
                        <option value="ready">Ready</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="out_of_service">Out of service</option>
                        <option value="retired">Retired</option>
                      </select>
                      <Button type="submit" variant="secondary">
                        Update
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              No named resources configured.
            </p>
          )}
        </Card>
      ) : null}
      <section className="grid gap-4">
        {(services ?? []).length ? (
          (services ?? []).map((service) => {
            const version = latestByService.get(service.id);
            return (
              <Card
                key={service.id}
                title={version?.customer_name ?? service.internal_name}
                description={`${service.category.replace('_', ' ')} · ${service.status} · version ${version?.version_number ?? '—'}`}
              >
                <dl className="grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <dt className="font-bold">Internal name</dt>
                    <dd>{service.internal_name}</dd>
                  </div>
                  <div>
                    <dt className="font-bold">Schedule</dt>
                    <dd>{version?.time_model.replaceAll('_', ' ') ?? 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="font-bold">Version state</dt>
                    <dd>{version?.status ?? 'Missing'}</dd>
                  </div>
                </dl>
                {version ? (
                  <p className="mt-4 text-sm text-[var(--text-secondary)]">
                    {requirements?.filter((item) => item.service_version_id === version.id)
                      .length ?? 0}{' '}
                    requirements ·{' '}
                    {questions?.filter((item) => item.service_version_id === version.id).length ??
                      0}{' '}
                    booking questions ·{' '}
                    {pools?.filter(
                      (pool) => pool.service_id === service.id && pool.status === 'active',
                    ).length ?? 0}{' '}
                    capacity pools
                  </p>
                ) : null}
                {canManage && version?.status === 'draft' && locations?.length ? (
                  <form action={publishService} className="mt-5 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input type="hidden" name="versionId" value={version.id} />
                    <label className="text-sm font-bold">
                      Location
                      <select
                        className="ml-2 min-h-11 rounded-lg border bg-white px-3"
                        name="locationId"
                      >
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <input
                        className="mr-2"
                        type="checkbox"
                        name="customerPortal"
                        defaultChecked
                      />
                      Customer portal
                    </label>
                    <label className="text-sm">
                      <input className="mr-2" type="checkbox" name="staffEntry" defaultChecked />
                      Staff entry
                    </label>
                    <label className="text-sm">
                      <input className="mr-2" type="checkbox" name="publicWebsite" />
                      Public website
                    </label>
                    <Button type="submit">Publish</Button>
                  </form>
                ) : null}
                {canManage && ['active', 'paused'].includes(service.status) ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <form action={changeServiceStatus} className="flex gap-3">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <Button
                        name="status"
                        value={service.status === 'active' ? 'paused' : 'active'}
                        type="submit"
                        variant="secondary"
                      >
                        {service.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                      <Button name="status" value="retired" type="submit" variant="danger">
                        Retire
                      </Button>
                    </form>
                    {version?.status === 'published' ? (
                      <form action={createServiceRevision}>
                        <input type="hidden" name="serviceId" value={service.id} />
                        <Button type="submit" variant="secondary">
                          Create draft revision
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Card
            title="No services yet"
            description="Create the first draft to begin configuring boarding, daycare, grooming, assessments, or add-ons."
          >
            <p className="text-sm text-[var(--text-secondary)]">
              Published services will appear here with their location and channel availability.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
