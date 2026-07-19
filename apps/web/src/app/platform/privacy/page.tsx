import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  createPrivacyRequest,
  recordPrivacyDomainAction,
  transitionPrivacyRequest,
} from './actions';

type Tenant = { business_id: string; name: string; public_slug: string };
type DomainAction = {
  action_type: string;
  domain_key: string;
  evidence_summary: string | null;
  status: string;
};
type PrivacyRequest = {
  business_name: string;
  domain_actions: DomainAction[];
  due_at: string;
  legal_hold: boolean;
  request_id: string;
  request_number: number;
  request_type: string;
  status: string;
  subject_reference: string;
};

const requestTypes = [
  'access',
  'correction',
  'portable_export',
  'processing_restriction',
  'deletion',
  'objection_review',
];
const domainKeys = [
  'identity',
  'customer',
  'pet',
  'booking',
  'operations',
  'commerce',
  'communications',
  'documents',
];

export default async function PlatformPrivacyPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [requestResult, tenantResult] = await Promise.all([
    supabase.rpc('list_platform_privacy_requests'),
    supabase.rpc('list_platform_tenants'),
  ]);
  const requests = (requestResult.data ?? []) as PrivacyRequest[];
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const canManage = context.permissions.has('platform.privacy.manage');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Privacy operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Privacy requests</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Verify identity, coordinate domain owners, honor holds, and retain minimized evidence.
        </p>
      </header>
      <Alert title="No unreviewed cascade deletion" tone="warning">
        Each owning domain records its approved action. Financial, safety, fraud, and legal
        retention can be evidenced without retaining deleted personal content here.
      </Alert>
      {requestResult.error || tenantResult.error ? (
        <Alert title="Privacy coordination unavailable" tone="danger">
          Request metadata could not be loaded.
        </Alert>
      ) : null}

      {canManage && tenants.length ? (
        <Card title="Record a privacy request">
          <form action={createPrivacyRequest} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Tenant
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="businessId"
                required
              >
                {tenants.map((tenant) => (
                  <option key={tenant.business_id} value={tenant.business_id}>
                    {tenant.name} ({tenant.public_slug})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Request type
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="requestType"
                required
              >
                {requestTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Minimized subject reference
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={8}
                name="subjectReference"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Intake channel
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="intakeChannel"
              >
                <option value="tenant_admin">Tenant admin</option>
                <option value="customer_support">Customer support</option>
                <option value="email">Email</option>
                <option value="legal">Legal</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Due date
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="dueAt"
                type="datetime-local"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="legalHold" type="checkbox" />
              Legal hold currently applies
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Intake reason
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="reason"
                required
              />
            </label>
            <div>
              <Button type="submit">Record request</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-5">
        {requests.map((request) => (
          <Card
            key={request.request_id}
            title={`PR-${request.request_number} · ${request.business_name}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  request.status === 'fulfilled'
                    ? 'success'
                    : request.legal_hold
                      ? 'warning'
                      : 'info'
                }
              >
                {request.status.replaceAll('_', ' ')}
              </Badge>
              <span className="text-sm">
                {request.request_type.replaceAll('_', ' ')} · due{' '}
                {new Date(request.due_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs">{request.subject_reference}</p>
            {request.domain_actions.length ? (
              <ul className="mt-4 grid gap-2 text-sm">
                {request.domain_actions.map((action) => (
                  <li key={action.domain_key}>
                    <strong>{action.domain_key}</strong>: {action.action_type} · {action.status}
                  </li>
                ))}
              </ul>
            ) : null}
            {canManage && !['fulfilled', 'denied'].includes(request.status) ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <form
                  action={transitionPrivacyRequest}
                  className="grid gap-3 rounded-lg border border-[var(--border)] p-4"
                >
                  <input name="requestId" type="hidden" value={request.request_id} />
                  <label className="grid gap-1 text-sm font-semibold">
                    Next state
                    <select
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                      name="nextStatus"
                      required
                    >
                      <option value="identity_verified">Identity verified</option>
                      <option value="in_progress">In progress</option>
                      <option value="review">Review</option>
                      <option value="fulfilled">Fulfilled</option>
                      <option value="denied">Denied</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Reason
                    <textarea
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      minLength={12}
                      name="reason"
                      required
                    />
                  </label>
                  <div>
                    <Button type="submit">Apply state</Button>
                  </div>
                </form>
                <form
                  action={recordPrivacyDomainAction}
                  className="grid gap-3 rounded-lg border border-[var(--border)] p-4"
                >
                  <input name="requestId" type="hidden" value={request.request_id} />
                  <label className="grid gap-1 text-sm font-semibold">
                    Domain
                    <select
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                      name="domainKey"
                    >
                      {domainKeys.map((domain) => (
                        <option key={domain}>{domain}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Action
                    <select
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                      name="actionType"
                    >
                      <option value="export">Export</option>
                      <option value="correct">Correct</option>
                      <option value="restrict">Restrict</option>
                      <option value="delete">Delete</option>
                      <option value="deidentify">Deidentify</option>
                      <option value="retain">Retain</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Status
                    <select
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                      name="status"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                      <option value="retained">Retained</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Evidence summary
                    <textarea
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      name="evidenceSummary"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Retention basis
                    <input
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      name="retentionBasis"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Reason
                    <textarea
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      minLength={12}
                      name="reason"
                      required
                    />
                  </label>
                  <div>
                    <Button type="submit" variant="secondary">
                      Record domain action
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
