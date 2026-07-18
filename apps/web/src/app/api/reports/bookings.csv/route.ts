import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createCsv } from '../../../../lib/reports/csv';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
const columns = [
  'booking_number',
  'booking_status',
  'source_channel',
  'customer_name',
  'pet_name',
  'service_name',
  'starts_at',
  'ends_at',
  'item_status',
] as const;

function reportDates(url: URL) {
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start?.match(/^\d{4}-\d{2}-\d{2}$/) || !end?.match(/^\d{4}-\d{2}-\d{2}$/)) return null;
  const periodStart = new Date(`${start}T00:00:00.000Z`);
  const periodEnd = new Date(`${end}T00:00:00.000Z`);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  if (
    Number.isNaN(periodStart.valueOf()) ||
    Number.isNaN(periodEnd.valueOf()) ||
    periodEnd <= periodStart
  )
    return null;
  return { periodEnd, periodStart };
}

export async function GET(request: Request) {
  const context = await resolveBusinessContext();
  if (!context) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  if (!context.permissions.has('reports.export'))
    return Response.json({ error: 'Export unavailable.' }, { status: 403 });
  const dates = reportDates(new URL(request.url));
  if (!dates)
    return Response.json({ error: 'Valid start and end dates are required.' }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_booking_activity_report', {
    export_value: true,
    period_end_value: dates.periodEnd.toISOString(),
    period_start_value: dates.periodStart.toISOString(),
    target_business_id: context.businessId,
  });
  if (error || !data) return Response.json({ error: 'Export unavailable.' }, { status: 503 });
  const rows = Array.isArray(data.rows) ? (data.rows as Record<string, unknown>[]) : [];
  return new Response(`\uFEFF${createCsv(columns, rows)}`, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="booking-activity-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
