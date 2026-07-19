import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { retryAdministrativeJob } from './actions';

type AdministrativeJob = {
  attempt_count: number;
  business_name: string | null;
  created_at: string;
  error_category: string | null;
  job_id: string;
  job_type: string;
  next_action: 'investigate' | 'none' | 'retry' | 'wait';
  object_reference: string | null;
  progress_percentage: number;
  retryable: boolean;
  safe_error_message: string | null;
  status: 'cancelled' | 'failed' | 'queued' | 'running' | 'succeeded';
};

export default async function PlatformJobsPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_platform_administrative_jobs');
  const jobs = (data ?? []) as AdministrativeJob[];
  const canManage = context.permissions.has('platform.jobs.manage');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Administrative jobs</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Sanitized progress, failure categories, attempt history, and only explicitly safe retries.
        </p>
      </header>
      <Alert title="Retries append history" tone="info">
        A retry never edits the failed attempt. Jobs without an idempotent retry contract remain
        investigation-only.
      </Alert>
      {error ? (
        <Alert title="Administrative jobs unavailable" tone="danger">
          Job state could not be loaded. No retry was requested.
        </Alert>
      ) : null}
      {!error && jobs.length === 0 ? (
        <Alert title="No administrative jobs" tone="info">
          Provisioning, reconciliation, export, verification, and replay work will appear here.
        </Alert>
      ) : null}

      <div className="grid gap-5">
        {jobs.map((job) => (
          <Card key={job.job_id} title={job.job_type.replaceAll('_', ' ')}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  job.status === 'succeeded'
                    ? 'success'
                    : job.status === 'failed'
                      ? 'danger'
                      : job.status === 'running'
                        ? 'info'
                        : 'neutral'
                }
              >
                {job.status}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                {job.business_name ?? 'Platform-wide'} · attempt {job.attempt_count} ·{' '}
                {job.progress_percentage}%
              </span>
            </div>
            {job.object_reference ? (
              <p className="mt-3 font-mono text-xs">{job.object_reference}</p>
            ) : null}
            {job.error_category ? (
              <Alert title={job.error_category} tone="warning">
                {job.safe_error_message ?? 'Review the approved diagnostic source.'}
              </Alert>
            ) : null}
            {canManage && job.next_action === 'retry' && job.retryable ? (
              <form action={retryAdministrativeJob} className="mt-4 flex flex-wrap items-end gap-3">
                <input name="jobId" type="hidden" value={job.job_id} />
                <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold">
                  Retry reason
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <Button type="submit">Queue safe retry</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
