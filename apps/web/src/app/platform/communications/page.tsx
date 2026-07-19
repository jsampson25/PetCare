import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';

import { resolvePlatformContext } from '../../../lib/auth/platform-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import {
  createInternalTenantNote,
  createOperationalNotice,
  transitionOperationalNotice,
} from './actions';

type Tenant = { business_id: string; name: string; public_slug: string };
type Notice = {
  acknowledgement_count: number;
  acknowledgement_required: boolean;
  audience: string;
  business_name: string | null;
  ends_at: string;
  message: string;
  notice_id: string;
  severity: 'critical' | 'info' | 'warning';
  starts_at: string;
  status: 'draft' | 'ended' | 'published';
  title: string;
};
type InternalNote = {
  business_name: string;
  category: string;
  created_at: string;
  legal_hold: boolean;
  note: string;
  note_id: string;
  retention_until: string;
};

export default async function PlatformCommunicationsPage() {
  const context = await resolvePlatformContext();
  if (!context) return null;
  const supabase = await createSupabaseServerClient();
  const [communicationResult, tenantResult] = await Promise.all([
    supabase.rpc('list_platform_communications'),
    supabase.rpc('list_platform_tenants'),
  ]);
  const communications = (communicationResult.data ?? { notices: [], notes: [] }) as {
    notes: InternalNote[];
    notices: Notice[];
  };
  const tenants = (tenantResult.data ?? []) as Tenant[];
  const canManageNotices = context.permissions.has('platform.communications.manage');
  const canManageNotes = context.permissions.has('platform.notes.manage');

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Platform coordination</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Notices and internal notes</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Publish bounded operational messages and retain restricted tenant context safely.
        </p>
      </header>
      <Alert title="Two deliberately separate records" tone="info">
        Published notices are tenant-visible. Internal notes never appear to tenant staff and are
        hidden after their retention date unless a legal hold applies.
      </Alert>
      {communicationResult.error || tenantResult.error ? (
        <Alert title="Platform communications unavailable" tone="danger">
          Notice or tenant metadata could not be loaded.
        </Alert>
      ) : null}

      {canManageNotices ? (
        <Card title="Draft an operational notice">
          <form action={createOperationalNotice} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Audience
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="audience"
              >
                <option value="all_tenants">All tenants</option>
                <option value="tenant">One tenant</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Tenant (required for one tenant)
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="businessId"
              >
                <option value="">Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.business_id} value={tenant.business_id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Severity
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="severity"
              >
                <option value="info">Information</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Title
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={5}
                name="title"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Starts
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="startsAt"
                type="datetime-local"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Ends
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="endsAt"
                type="datetime-local"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Tenant-visible message
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="message"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="acknowledgementRequired" type="checkbox" />
              Require acknowledgement
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Internal publication reason
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="reason"
                required
              />
            </label>
            <div>
              <Button type="submit">Save draft</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-xl font-bold">Operational notices</h2>
        {communications.notices.map((notice) => (
          <Card key={notice.notice_id} title={notice.title}>
            <div className="flex flex-wrap gap-2">
              <Badge
                tone={
                  notice.severity === 'critical'
                    ? 'danger'
                    : notice.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
              >
                {notice.severity}
              </Badge>
              <Badge tone={notice.status === 'published' ? 'success' : 'neutral'}>
                {notice.status}
              </Badge>
            </div>
            <p className="mt-3 text-sm">{notice.message}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {notice.business_name ?? 'All tenants'} ·{' '}
              {new Date(notice.starts_at).toLocaleString()} through{' '}
              {new Date(notice.ends_at).toLocaleString()} · {notice.acknowledgement_count}{' '}
              acknowledgement(s)
            </p>
            {canManageNotices && notice.status !== 'ended' ? (
              <form
                action={transitionOperationalNotice}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input name="noticeId" type="hidden" value={notice.notice_id} />
                <input
                  name="nextStatus"
                  type="hidden"
                  value={notice.status === 'draft' ? 'published' : 'ended'}
                />
                <label className="grid flex-1 gap-1 text-sm font-semibold">
                  Reason
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    minLength={12}
                    name="reason"
                    required
                  />
                </label>
                <Button type="submit" variant="secondary">
                  {notice.status === 'draft' ? 'Publish' : 'End notice'}
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </section>

      {canManageNotes ? (
        <Card title="Append a restricted internal note">
          <form action={createInternalTenantNote} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Tenant
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="businessId"
                required
              >
                {tenants.map((tenant) => (
                  <option key={tenant.business_id} value={tenant.business_id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Category
              <select
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                name="category"
              >
                <option>support</option>
                <option>billing</option>
                <option>risk</option>
                <option>privacy</option>
                <option>operations</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Retention through
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                name="retentionUntil"
                type="date"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="legalHold" type="checkbox" />
              Legal hold
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Internal note
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="note"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Reason for retaining this note
              <textarea
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                minLength={12}
                name="reason"
                required
              />
            </label>
            <div>
              <Button type="submit">Append note</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {communications.notes.length ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-bold">Retained internal notes</h2>
          {communications.notes.map((note) => (
            <Card key={note.note_id} title={`${note.business_name} · ${note.category}`}>
              <p className="text-sm">{note.note}</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Retain through {new Date(note.retention_until).toLocaleDateString()}
                {note.legal_hold ? ' · legal hold' : ''} · added{' '}
                {new Date(note.created_at).toLocaleString()}
              </p>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
