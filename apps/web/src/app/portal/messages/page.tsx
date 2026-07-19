import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { PortalPageHeader } from '../_components/portal-page-header';

export default async function MessagesPage() {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  return (
    <div className="space-y-6">
      <PortalPageHeader
        description="A delivery record of booking confirmations, payment notices, and care updates."
        eyebrow="Communication center"
        title="Messages"
        action={
          <a
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] bg-white px-4 py-2 text-sm font-bold shadow-sm"
            href="/portal/requests"
          >
            Contact the care team
          </a>
        }
      />
      {dashboard.messages.length ? (
        <Card className="!p-0">
          <div className="border-b border-[var(--border-default)] px-5 py-4">
            <p className="font-black">Recent delivery activity</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Newest messages appear first.
            </p>
          </div>
          <div className="divide-y divide-[var(--border-default)]">
            {dashboard.messages.map((message) => (
              <article
                className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                key={message.id}
              >
                <span
                  className="grid size-11 place-items-center rounded-xl bg-[var(--surface-subtle)] text-xs font-black uppercase text-[var(--action-primary)]"
                  aria-hidden="true"
                >
                  {message.channel.slice(0, 2)}
                </span>
                <div>
                  <p className="font-black capitalize">
                    {message.message_type.replaceAll('_', ' ')}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                    <span className="capitalize">{message.channel}</span> ·{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(message.created_at))}
                  </p>
                </div>
                <Badge
                  tone={
                    message.status === 'sent'
                      ? 'success'
                      : message.status === 'failed'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {message.status}
                </Badge>
              </article>
            ))}
          </div>
        </Card>
      ) : (
        <StatePanel
          title="No messages"
          description="Booking, payment, check-in, and report-card notices will appear here."
        />
      )}
    </div>
  );
}
