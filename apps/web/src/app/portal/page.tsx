import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';
import { StatePanel } from '@petcare/ui/state-panel';

export default function PortalPage() {
  return (
    <div>
      <p className="text-sm font-bold text-[var(--action-primary)]">Customer portal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Manage your pets and upcoming care.</p>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card title="Upcoming reservation" description="Bella’s next stay">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold">Boarding · 3 nights</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">August 14–17</p>
            </div>
            <Badge tone="success">Confirmed</Badge>
          </div>
        </Card>
        <StatePanel
          description="Updates and report cards from your care team will appear here."
          title="No new messages"
        />
      </div>
    </div>
  );
}
