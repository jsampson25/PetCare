import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
export default async function MessagesPage() {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Communication history</p>
        <h1 className="mt-2 text-3xl font-black">Messages</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Recent transactional notices and their delivery state.
        </p>
      </header>
      {d.messages.length ? (
        <Card>
          <div className="grid gap-3">
            {d.messages.map((message) => (
              <article
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                key={message.id}
              >
                <div>
                  <p className="font-black">{message.message_type.replaceAll('_', ' ')}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {message.channel} ·{' '}
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
