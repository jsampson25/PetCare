import { randomUUID } from 'node:crypto';
import { resolvePlatformContext } from '../../../../../lib/auth/platform-context';
import { createCsv } from '../../../../../lib/reports/csv';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
export const dynamic = 'force-dynamic';
const columns = [
  'event_id',
  'business_id',
  'business_name',
  'actor_id',
  'event_type',
  'risk',
  'summary',
  'case_key',
  'occurred_at',
] as const;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const context = await resolvePlatformContext();
  if (!context) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  if (!context.permissions.has('platform.audit.export'))
    return Response.json({ error: 'Export unavailable.' }, { status: 403 });
  const { requestId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('consume_platform_audit_export', {
    export_request_id_value: requestId,
    download_key: `audit-download-${randomUUID()}`,
  });
  if (error || !data)
    return Response.json({ error: 'Approved export is unavailable or expired.' }, { status: 403 });
  const rows = Array.isArray(data.rows) ? (data.rows as Record<string, unknown>[]) : [];
  return new Response(`\uFEFF${createCsv(columns, rows)}`, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="platform-audit-${requestId}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
