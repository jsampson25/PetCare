import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function ArrivalsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('operations.check_in')) redirect('/denied');
  const parameters = await searchParams;
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
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--action-primary)]">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Arrivals</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Record physical arrival first, then complete identity, safety, care, and custody review.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-subtle)] px-4 py-2 text-sm font-black">
          {items?.length ?? 0} expected
        </span>
      </header>
      {typeof parameters.error === 'string' ? (
        <Alert title="Arrival unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <Card
        className="overflow-hidden"
        title="Expected pets"
        description="Confirmed bookings remain reservations until custody is explicitly accepted."
      >
        {items?.length ? (
          <div className="divide-y divide-[var(--border-default)]">
            {items.map((item, index) => {
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
              const pendingHandoff = booking.operational_visits?.[0]?.pet_visits?.some(
                (visit) => visit.handoff_status === 'pending',
              );
              const displayStatus = pendingHandoff
                ? 'handoff pending'
                : visitStatus.replaceAll('_', ' ');
              return (
                <div
                  className="grid gap-4 p-5 transition hover:bg-[var(--surface-subtle)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  key={`${item.booking_id}-${index}`}
                >
                  <span
                    className="grid size-12 place-items-center rounded-2xl bg-[#dcece2] font-black text-[#155b3d]"
                    aria-hidden="true"
                  >
                    {pet?.name?.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-black">
                      {pet?.name} · {service?.customer_name}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {booking.booking_number} · {booking.customers?.first_name}{' '}
                      {booking.customers?.last_name} · {booking.locations?.name}
                    </p>
                    <p className="mt-1 text-sm">
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.starts_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <ButtonLink href={`/app/arrivals/${item.booking_id}`} variant="secondary">
                      Open check-in
                    </ButtonLink>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No confirmed arrivals are currently scheduled.
          </p>
        )}
      </Card>
    </div>
  );
}
