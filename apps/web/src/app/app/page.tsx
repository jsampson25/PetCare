import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Card } from '@petcare/ui/card';

export default function BusinessHomePage() {
  return (
    <div>
      <p className="text-sm font-bold text-[var(--action-primary)]">Friday, July 17</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Today</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        The work and exceptions needing attention now.
      </p>
      <div className="mt-8">
        <Alert title="2 items need review" tone="warning">
          One vaccination expires before an upcoming stay and one medication task is due soon.
        </Alert>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Arrivals', '8', 'info'],
          ['Pets in care', '34', 'success'],
          ['Tasks due', '12', 'warning'],
          ['Departures', '6', 'neutral'],
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
    </div>
  );
}
