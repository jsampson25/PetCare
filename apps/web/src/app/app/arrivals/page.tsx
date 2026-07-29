import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { RecordList, RecordListItem } from '@petcare/ui/record-list';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { filterArrivalQueue, summarizeArrivalQueue } from './arrival-queue-view';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function ArrivalsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const parameters = await searchParams;
  const viewParameter = typeof parameters.view === 'string' ? parameters.view : 'all';
  const requestedView = ['all', 'expected', 'handoff', 'in_care'].includes(viewParameter)
    ? viewParameter
    : 'all';
  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase
    .from('booking_items')
    .select(
      'booking_id,starts_at,ends_at,pets(name,breed),service_versions(customer_name),bookings!inner(booking_number,status,customers(first_name,last_name),locations(name),operational_visits(status,pet_visits(handoff_status)))',
    )
    .eq('business_id', context.businessId)
    .eq('status', 'confirmed')
    .eq('bookings.status', 'confirmed')
    .order('starts_at')
    .limit(100);
  const arrivalRows = (items ?? []).map((item, index) => {
    const booking = item.bookings as unknown as {
      booking_number: string;
      status: string;
      customers: { first_name: string; last_name: string } | null;
      locations: { name: string } | null;
      operational_visits:
        | {
            status: string;
            pet_visits: { handoff_status: string }[] | null;
          }[]
        | null;
    };
    const pet = item.pets as unknown as { name: string; breed: string } | null;
    const service = item.service_versions as unknown as { customer_name: string } | null;
    const visitStatus = booking.operational_visits?.[0]?.status ?? 'expected';
    const pendingHandoff =
      booking.operational_visits?.[0]?.pet_visits?.some(
        (visit) => visit.handoff_status === 'pending',
      ) ?? false;
    return {
      item,
      index,
      booking,
      pet,
      service,
      visitStatus,
      pendingHandoff,
      visit_status: visitStatus,
      pending_handoff: pendingHandoff,
    };
  });
  const visibleRows = filterArrivalQueue(arrivalRows, requestedView);
  const summary = summarizeArrivalQueue(arrivalRows);
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ButtonLink
            href="/app/calendar"
            leadingIcon={<Icon name="calendar" />}
            variant="secondary"
          >
            Open calendar
          </ButtonLink>
        }
        description="Record physical arrival first, then complete identity, safety, care, and custody review."
        eyebrow="Operations"
        title="Arrivals"
      />
      {typeof parameters.error === 'string' ? (
        <Alert title="Arrival unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <CommandBar
        description="Separate pets still expected from custody handoffs and pets already accepted into care."
        title="Filter arrival queue"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <SelectField
            defaultValue={requestedView}
            density="compact"
            label="Arrival view"
            name="view"
          >
            <option value="all">All scheduled arrivals</option>
            <option value="expected">Expected or arrived</option>
            <option value="handoff">Handoff pending</option>
            <option value="in_care">Accepted into care</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filter
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Arrival summary" title="Check-in progress" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Scheduled" value={summary.scheduled} />
          <SummaryMetric label="Expected" value={summary.expected} />
          <SummaryMetric label="Handoff pending" value={summary.handoff} />
          <SummaryMetric label="In care" value={summary.inCare} />
        </dl>
      </Card>
      <Card
        className="overflow-hidden"
        description="Confirmed bookings remain reservations until custody is explicitly accepted."
        eyebrow="Check-in queue"
        title="Scheduled pets"
      >
        {visibleRows.length ? (
          <RecordList>
            {visibleRows.map(
              ({ item, index, booking, pet, service, visitStatus, pendingHandoff }) => {
                const displayStatus = pendingHandoff
                  ? 'handoff pending'
                  : visitStatus.replaceAll('_', ' ');
                return (
                  <RecordListItem
                    action={
                      <ButtonLink
                        href={`/app/arrivals/${item.booking_id}`}
                        leadingIcon={<Icon name="arrow-right" />}
                        variant="secondary"
                      >
                        Open check-in
                      </ButtonLink>
                    }
                    description={
                      <>
                        <span className="block">
                          {booking.booking_number} · {booking.customers?.first_name}{' '}
                          {booking.customers?.last_name} · {booking.locations?.name}
                        </span>
                        <span className="block text-[var(--text-primary)]">
                          {new Intl.DateTimeFormat('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(item.starts_at))}
                        </span>
                      </>
                    }
                    key={`${item.booking_id}-${index}`}
                    leading={
                      <span
                        aria-hidden="true"
                        className="grid size-12 place-items-center rounded-2xl bg-blue-50 font-black text-blue-700"
                      >
                        {pet?.name?.slice(0, 2).toUpperCase()}
                      </span>
                    }
                    status={
                      <Badge
                        tone={
                          pendingHandoff
                            ? 'warning'
                            : visitStatus === 'in_care'
                              ? 'success'
                              : visitStatus === 'arrived'
                                ? 'warning'
                                : 'info'
                        }
                      >
                        {displayStatus}
                      </Badge>
                    }
                    title={
                      <>
                        {pet?.name} · {service?.customer_name}
                      </>
                    }
                  />
                );
              },
            )}
          </RecordList>
        ) : (
          <StatePanel
            description={
              arrivalRows.length
                ? 'No pets match the selected arrival state.'
                : 'Confirmed reservations will appear here when they are ready for physical arrival.'
            }
            size="compact"
            title={arrivalRows.length ? 'No matching arrivals' : 'No confirmed arrivals scheduled'}
          />
        )}
      </Card>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm font-bold text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-1 text-3xl font-black tracking-tight text-[var(--text-primary)]">
        {value}
      </dd>
    </div>
  );
}
