import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { reviewCustomerRequest } from './actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function CustomerRequestsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('customers.manage')) redirect('/denied');
  const p = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from('customer_service_requests')
    .select(
      'id,request_type,status,subject,details,submitted_at,customers(first_name,last_name),bookings(booking_number)',
    )
    .eq('business_id', context.businessId)
    .in('status', ['submitted', 'in_review', 'approved'])
    .order('submitted_at');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Customer operations</p>
        <h1 className="mt-2 text-3xl font-black">Customer requests</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Review requests explicitly; approval does not silently modify a booking.
        </p>
      </header>
      {typeof p.notice === 'string' ? (
        <Alert title="Request updated" tone="success">
          {p.notice}
        </Alert>
      ) : null}
      {typeof p.error === 'string' ? (
        <Alert title="Review unavailable" tone="danger">
          {p.error}
        </Alert>
      ) : null}
      {requests?.length ? (
        <div className="grid gap-5">
          {requests.map((request) => {
            const customer = request.customers as unknown as {
              first_name: string;
              last_name: string;
            } | null;
            const booking = request.bookings as unknown as { booking_number: string } | null;
            const details = request.details as { message?: string };
            const options =
              request.status === 'submitted'
                ? ['in_review', 'declined']
                : request.status === 'in_review'
                  ? ['approved', 'declined']
                  : ['completed'];
            return (
              <Card
                key={request.id}
                title={request.subject}
                description={`${customer?.first_name ?? 'Customer'} ${customer?.last_name ?? ''} · ${booking?.booking_number ?? 'Account request'}`}
              >
                <div className="flex gap-2">
                  <Badge tone="warning">{request.status.replaceAll('_', ' ')}</Badge>
                  <Badge>{request.request_type.replaceAll('_', ' ')}</Badge>
                </div>
                <p className="my-4">{details.message}</p>
                <form
                  action={reviewCustomerRequest}
                  className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
                >
                  <input name="requestId" type="hidden" value={request.id} />
                  <label className="text-sm font-bold">
                    Next status
                    <select
                      className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
                      name="status"
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field label="Review notes" name="notes" required />
                  <Button type="submit">Update request</Button>
                </form>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">No customer requests need review.</p>
        </Card>
      )}
    </div>
  );
}
