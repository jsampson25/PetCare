import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { PortalPageHeader } from '../_components/portal-page-header';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage({ searchParams }: { searchParams: SearchParameters }) {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from('customer_service_requests')
    .select('id,request_type,status,subject,details,submitted_at,bookings(booking_number)')
    .eq('business_id', dashboard.business.id)
    .order('submitted_at', { ascending: false });
  return (
    <div className="space-y-6">
      <PortalPageHeader
        description="Follow every change or cancellation request while confirmed care stays protected."
        eyebrow="Help from the care team"
        title="Requests"
        action={
          <a
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--action-primary)] px-5 py-3 text-sm font-bold text-white"
            href="/portal/reservations"
          >
            Start from a reservation
          </a>
        }
      />
      {typeof parameters.notice === 'string' ? (
        <Alert title="Request received" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {requests?.length ? (
        <div className="relative grid gap-4 before:absolute before:bottom-6 before:left-[1.15rem] before:top-6 before:w-px before:bg-[var(--border-default)]">
          {requests.map((request) => {
            const booking = request.bookings as unknown as { booking_number: string } | null;
            const details = request.details as { message?: string };
            const complete = request.status === 'completed' || request.status === 'approved';
            return (
              <div className="relative pl-12" key={request.id}>
                <span
                  className={`absolute left-2 top-6 z-10 size-5 rounded-full border-4 border-[var(--surface-canvas)] ${complete ? 'bg-emerald-500' : request.status === 'declined' ? 'bg-red-500' : 'bg-amber-400'}`}
                  aria-hidden="true"
                />
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {booking?.booking_number ?? 'Account request'} ·{' '}
                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                          new Date(request.submitted_at),
                        )}
                      </p>
                      <h2 className="mt-1 text-lg font-black">{request.subject}</h2>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        tone={
                          complete
                            ? 'success'
                            : request.status === 'declined'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {request.status.replaceAll('_', ' ')}
                      </Badge>
                      <Badge>{request.request_type.replaceAll('_', ' ')}</Badge>
                    </div>
                  </div>
                  <p className="mt-4 leading-7 text-[var(--text-secondary)]">{details.message}</p>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <StatePanel
          title="No requests"
          description="Change, cancellation, profile, and document-support requests will appear here."
        />
      )}
    </div>
  );
}
