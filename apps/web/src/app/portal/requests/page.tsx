import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function RequestsPage({ searchParams }: { searchParams: SearchParameters }) {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  const p = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from('customer_service_requests')
    .select('id,request_type,status,subject,details,submitted_at,bookings(booking_number)')
    .eq('business_id', d.business.id)
    .order('submitted_at', { ascending: false });
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Self-service</p>
        <h1 className="mt-2 text-3xl font-black">Requests</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Track requests without changing confirmed reservations until staff approve them.
        </p>
      </header>
      {typeof p.notice === 'string' ? (
        <Alert title="Request received" tone="success">
          {p.notice}
        </Alert>
      ) : null}
      {requests?.length ? (
        <div className="grid gap-4">
          {requests.map((request) => {
            const booking = request.bookings as unknown as { booking_number: string } | null;
            const details = request.details as { message?: string };
            return (
              <Card
                key={request.id}
                title={request.subject}
                description={`${booking?.booking_number ?? 'Account'} · ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(request.submitted_at))}`}
              >
                <div className="flex flex-wrap gap-2">
                  <Badge
                    tone={
                      request.status === 'completed' || request.status === 'approved'
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
                <p className="mt-4">{details.message}</p>
              </Card>
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
