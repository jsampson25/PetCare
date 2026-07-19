import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';

import { resolveBusinessContext } from '../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { acknowledgePlatformNotice } from './actions';

type PlatformNotice = {
  acknowledgement_required: boolean;
  acknowledged: boolean;
  ends_at: string;
  message: string;
  notice_id: string;
  severity: 'critical' | 'info' | 'warning';
  title: string;
};

export default async function BusinessHomePage() {
  const context = await resolveBusinessContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const canCheckIn = context.permissions.has('operations.check_in');
  const canWork =
    context.permissions.has('operations.record_feeding') ||
    context.permissions.has('operations.record_medication');
  const canExecuteServices = context.permissions.has('operations.execute_service');
  const { data: noticeData } = await supabase.rpc('list_active_tenant_notices', {
    target_business_id: context.businessId,
  });
  const platformNotices = (noticeData ?? []) as PlatformNotice[];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [arrivalResult, visitResult, taskResult, executionResult, alertResult] = await Promise.all([
    canCheckIn
      ? supabase
          .from('booking_items')
          .select('id,bookings!inner(status)', { count: 'exact', head: true })
          .eq('business_id', context.businessId)
          .eq('status', 'confirmed')
          .eq('bookings.status', 'confirmed')
          .gte('starts_at', start.toISOString())
          .lt('starts_at', end.toISOString())
      : Promise.resolve({ count: 0 }),
    canCheckIn
      ? supabase
          .from('pet_visits')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', context.businessId)
          .eq('status', 'in_care')
      : Promise.resolve({ count: 0 }),
    canWork
      ? supabase
          .from('care_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', context.businessId)
          .in('status', ['scheduled', 'in_progress'])
          .lte('due_starts_at', new Date().toISOString())
      : Promise.resolve({ count: 0 }),
    canExecuteServices
      ? supabase
          .from('service_executions')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', context.businessId)
          .neq('stage', 'completed')
      : Promise.resolve({ count: 0 }),
    canWork
      ? supabase
          .from('operational_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', context.businessId)
          .in('status', ['open', 'acknowledged'])
      : Promise.resolve({ count: 0 }),
  ]);
  const openAlerts = alertResult.count ?? 0;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">
          {new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date())}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Today</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Live work and exceptions needing attention now.
        </p>
      </header>
      {platformNotices.map((notice) => (
        <Alert
          key={notice.notice_id}
          title={notice.title}
          tone={
            notice.severity === 'critical'
              ? 'danger'
              : notice.severity === 'warning'
                ? 'warning'
                : 'info'
          }
        >
          <p>{notice.message}</p>
          <p className="mt-1 text-xs">Ends {new Date(notice.ends_at).toLocaleString()}</p>
          {notice.acknowledgement_required && !notice.acknowledged ? (
            <form action={acknowledgePlatformNotice} className="mt-3">
              <input name="noticeId" type="hidden" value={notice.notice_id} />
              <button className="font-semibold underline" type="submit">
                Acknowledge notice
              </button>
            </form>
          ) : notice.acknowledged ? (
            <p className="mt-2 text-xs font-semibold">Acknowledged</p>
          ) : null}
        </Alert>
      ))}
      {openAlerts ? (
        <Alert title={`${openAlerts} care alert(s) need follow-up`} tone="danger">
          Refused, missed, unavailable, and adverse care outcomes remain visible until resolved.
        </Alert>
      ) : (
        <Alert title="No open care alerts" tone="success">
          The current operational queue has no unresolved care exceptions.
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['Arrivals today', arrivalResult.count ?? 0, 'info'],
          ['Pets in care', visitResult.count ?? 0, 'success'],
          ['Tasks due', taskResult.count ?? 0, taskResult.count ? 'warning' : 'neutral'],
          ['Active services', executionResult.count ?? 0, 'info'],
        ].map(([label, value, tone]) => (
          <Card key={label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums">{value}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{label}</p>
              </div>
              <Badge tone={tone as 'info' | 'neutral' | 'success' | 'warning'}>{label}</Badge>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {canWork ? <ButtonLink href="/app/tasks">Open care work</ButtonLink> : null}
        {canExecuteServices ? (
          <ButtonLink href="/app/service-board" variant="secondary">
            Open service boards
          </ButtonLink>
        ) : null}
        {canCheckIn ? (
          <ButtonLink href="/app/arrivals" variant="secondary">
            Open arrivals
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
