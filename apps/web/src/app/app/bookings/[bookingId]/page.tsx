import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { notFound, redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { cancelBooking, rescheduleBooking, resolveBookingReview } from '../actions';

type PageParameters = Promise<{ bookingId: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: PageParameters;
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('bookings.view')) redirect('/denied');
  const { bookingId } = await params;
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id,booking_number,status,source_channel,current_revision_number,created_at,customers(first_name,last_name,email,phone),locations(name)',
    )
    .eq('business_id', context.businessId)
    .eq('id', bookingId)
    .single();
  if (!booking) notFound();
  const [{ data: revision }, { data: items }, { data: validations }, { data: timeline }] =
    await Promise.all([
      supabase
        .from('booking_revisions')
        .select(
          'id,quote_id,status,validation_snapshot,created_at,quotes(currency_code,subtotal_minor,discount_minor,fee_minor,tax_minor,total_minor,deposit_due_minor,balance_due_minor)',
        )
        .eq('business_id', context.businessId)
        .eq('booking_id', bookingId)
        .eq('revision_number', booking.current_revision_number)
        .single(),
      supabase
        .from('booking_items')
        .select(
          'id,starts_at,ends_at,quantity,status,pets(name,breed),service_versions(customer_name)',
        )
        .eq('business_id', context.businessId)
        .eq('booking_id', bookingId),
      supabase
        .from('booking_validation_results')
        .select('id,check_type,outcome,blocking,customer_message')
        .eq('business_id', context.businessId)
        .eq(
          'booking_revision_id',
          (
            await supabase
              .from('booking_revisions')
              .select('id')
              .eq('business_id', context.businessId)
              .eq('booking_id', bookingId)
              .eq('revision_number', booking.current_revision_number)
              .single()
          ).data?.id ?? '',
        ),
      supabase
        .from('booking_timeline_events')
        .select('id,event_type,summary,occurred_at,customer_visible')
        .eq('business_id', context.businessId)
        .eq('booking_id', bookingId)
        .order('occurred_at', { ascending: false }),
    ]);
  const customer = booking.customers as unknown as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
  const location = booking.locations as unknown as { name: string } | null;
  const quote = revision?.quotes as unknown as {
    currency_code: string;
    subtotal_minor: number;
    discount_minor: number;
    fee_minor: number;
    tax_minor: number;
    total_minor: number;
    deposit_due_minor: number;
    balance_due_minor: number;
  } | null;
  const money = (minor: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: quote?.currency_code ?? 'USD',
    }).format(minor / 100);
  const cancellable = [
    'confirmed',
    'pending_deposit',
    'pending_approval',
    'action_required',
  ].includes(booking.status);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">
          {location?.name} · {booking.source_channel.replaceAll('_', ' ')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight">{booking.booking_number}</h1>
          <Badge
            tone={
              booking.status === 'confirmed'
                ? 'success'
                : booking.status === 'cancelled'
                  ? 'danger'
                  : 'warning'
            }
          >
            {booking.status.replaceAll('_', ' ')}
          </Badge>
        </div>
        <p className="mt-2 text-[var(--text-secondary)]">
          {customer?.first_name} {customer?.last_name} · {customer?.email} · {customer?.phone}
        </p>
      </header>
      {typeof parameters.notice === 'string' ? (
        <Alert title="Booking updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Booking update failed" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      {booking.status === 'pending_deposit' ? (
        <Alert title="Deposit required" tone="warning">
          This request is not confirmed. Payment collection will be connected in E08.
        </Alert>
      ) : null}
      {booking.status === 'action_required' ? (
        <Alert title="Staff review required" tone="warning">
          Resolve the blocking eligibility or document requirements before confirmation.
        </Alert>
      ) : null}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card title="Service schedule">
          {items?.map((item) => {
            const pet = item.pets as unknown as { name: string; breed: string } | null;
            const service = item.service_versions as unknown as { customer_name: string } | null;
            return (
              <div key={item.id}>
                <p className="font-black">
                  {pet?.name} · {service?.customer_name}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.starts_at))}{' '}
                  to{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.ends_at))}
                </p>
                <p className="mt-1 text-sm">
                  {item.quantity} capacity unit(s) · {item.status}
                </p>
              </div>
            );
          })}
        </Card>
        <Card title={quote ? `${money(quote.total_minor)} total` : 'Quote unavailable'}>
          {quote ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="font-bold">Subtotal</dt>
                <dd>{money(quote.subtotal_minor)}</dd>
              </div>
              <div>
                <dt className="font-bold">Adjustments</dt>
                <dd>{money(quote.fee_minor)}</dd>
              </div>
              <div>
                <dt className="font-bold">Discount</dt>
                <dd>−{money(quote.discount_minor)}</dd>
              </div>
              <div>
                <dt className="font-bold">Tax</dt>
                <dd>{money(quote.tax_minor)}</dd>
              </div>
              <div>
                <dt className="font-bold">Deposit due</dt>
                <dd>{money(quote.deposit_due_minor)}</dd>
              </div>
              <div>
                <dt className="font-bold">Remaining</dt>
                <dd>{money(quote.balance_due_minor)}</dd>
              </div>
            </dl>
          ) : null}
        </Card>
      </section>
      <Card
        title="Validation"
        description="Each prerequisite is recorded against the immutable booking revision."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {validations?.map((result) => (
            <div className="rounded-lg border p-3" key={result.id}>
              <div className="flex justify-between gap-3">
                <p className="font-bold">{result.check_type}</p>
                <Badge
                  tone={
                    result.outcome === 'passed' ? 'success' : result.blocking ? 'warning' : 'info'
                  }
                >
                  {result.outcome}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{result.customer_message}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Timeline">
        {timeline?.length ? (
          <ol className="space-y-4">
            {timeline.map((event) => (
              <li className="border-l-2 pl-4" key={event.id}>
                <p className="font-bold">{event.summary}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(event.occurred_at))}{' '}
                  · {event.customer_visible ? 'customer visible' : 'internal'}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p>No timeline events.</p>
        )}
      </Card>
      {['action_required', 'pending_approval'].includes(booking.status) &&
      context.permissions.has('bookings.modify') ? (
        <Card
          title="Resolve staff review"
          description="Approval still requires a valid capacity hold and never bypasses a required deposit."
        >
          <form action={resolveBookingReview} className="grid gap-4 md:grid-cols-3">
            <input name="bookingId" type="hidden" value={booking.id} />
            <label className="text-sm font-bold">
              Decision
              <select
                className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3"
                name="decision"
              >
                <option value="approved">Approve</option>
                <option value="changes_requested">Request changes</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            <Field label="Decision reason" name="reason" minLength={8} required />
            <div className="self-end">
              <Button type="submit">Record decision</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {booking.status === 'confirmed' && context.permissions.has('bookings.modify') ? (
        <Card
          title="Reschedule booking"
          description="Replacement capacity is secured before the existing commitment is released. Changes requiring additional payment stop safely."
        >
          <form action={rescheduleBooking} className="grid gap-4 md:grid-cols-3">
            <input name="bookingId" type="hidden" value={booking.id} />
            <Field label="New start" name="startsAt" type="datetime-local" required />
            <Field label="New end" name="endsAt" type="datetime-local" required />
            <Field
              label="Charge units"
              name="units"
              type="number"
              min="1"
              max="365"
              defaultValue="1"
              required
            />
            <Field label="Discount code (optional)" name="coupon" />
            <Field label="Change reason" name="reason" minLength={8} required />
            <div className="self-end">
              <Button type="submit" variant="secondary">
                Validate and reschedule
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      {cancellable && context.permissions.has('bookings.cancel') ? (
        <Card
          title="Cancel booking"
          description="Cancellation preserves the accepted policy outcome and releases future capacity."
        >
          <form action={cancelBooking} className="flex flex-wrap items-end gap-4">
            <input name="bookingId" type="hidden" value={booking.id} />
            <Field label="Cancellation reason" name="reason" minLength={8} required />
            <Button type="submit" variant="danger">
              Cancel booking
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
