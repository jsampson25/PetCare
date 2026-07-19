import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { retryProvisioningStep } from './actions';

type Step = {
  attempt_count: number;
  error_category: string | null;
  retryable: boolean;
  safe_error_message: string | null;
  sequence_number: number;
  status: string;
  step_key: string;
};
type Run = {
  attempt_count: number;
  business_name: string;
  current_step_key: string | null;
  public_slug: string;
  run_id: string;
  started_at: string;
  status: string;
  steps: Step[];
};

export default async function PlatformProvisioningPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_tenant_provisioning_runs');
  const runs = (data ?? []) as Run[];
  const canManage = context.permissions.has('platform.provisioning.manage');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Tenant operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Provisioning runs</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Resumable tenant creation with ordered readiness steps and supported recovery.
        </p>
      </header>
      <Alert title="Retries resume the failed step" tone="info">
        Completed steps remain intact. Only a failed step declared safely retryable offers a
        recovery command.
      </Alert>
      {error ? (
        <Alert title="Provisioning unavailable" tone="danger">
          Run metadata could not be loaded.
        </Alert>
      ) : null}
      {!error && runs.length === 0 ? (
        <Alert title="No provisioning runs" tone="info">
          New tenant orchestration will appear here as businesses are registered.
        </Alert>
      ) : null}
      <div className="grid gap-5">
        {runs.map((run) => (
          <Card key={run.run_id} title={`${run.business_name} · ${run.public_slug}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  run.status === 'completed'
                    ? 'success'
                    : run.status === 'failed'
                      ? 'danger'
                      : 'info'
                }
              >
                {run.status}
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                run attempt {run.attempt_count} · started{' '}
                {new Date(run.started_at).toLocaleString()}
              </span>
            </div>
            <ol className="mt-5 grid gap-2">
              {run.steps.map((step) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
                  key={step.step_key}
                >
                  <span>
                    <strong>
                      {step.sequence_number}. {step.step_key.replaceAll('_', ' ')}
                    </strong>
                    {step.error_category ? (
                      <span className="ml-2 text-sm text-[var(--danger-foreground)]">
                        {step.error_category}: {step.safe_error_message}
                      </span>
                    ) : null}
                  </span>
                  <Badge
                    tone={
                      step.status === 'completed'
                        ? 'success'
                        : step.status === 'failed'
                          ? 'danger'
                          : step.status === 'running'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {step.status}
                  </Badge>
                </li>
              ))}
            </ol>
            {canManage &&
            run.status === 'failed' &&
            run.steps.find((step) => step.step_key === run.current_step_key)?.retryable ? (
              <form action={retryProvisioningStep} className="mt-4 flex flex-wrap items-end gap-3">
                <input name="runId" type="hidden" value={run.run_id} />
                <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold">
                  Retry reason
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <Button type="submit">Retry failed step</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
