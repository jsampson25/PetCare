import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { changeServiceStatus, createServiceDraft, publishService } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('services.view')) redirect('/denied');
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: services }, { data: versions }, { data: locations }] = await Promise.all([
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
  ]);
  const latestByService = new Map<string, NonNullable<typeof versions>[number]>();
  for (const version of versions ?? [])
    if (!latestByService.has(version.service_id)) latestByService.set(version.service_id, version);
  const canManage = context.permissions.has('services.manage');

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
      {canManage ? (
        <Card
          title="Create a service draft"
          description="Drafts remain internal until you publish them for a location and channel."
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
                  <form action={changeServiceStatus} className="mt-5 flex gap-3">
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
