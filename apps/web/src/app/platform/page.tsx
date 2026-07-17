import { Alert } from '@petcare/ui/alert';
import { Card } from '@petcare/ui/card';

export default function PlatformHomePage() {
  return (
    <div>
      <p className="text-sm font-bold text-[var(--action-primary)]">Privileged surface</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Platform health</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Cross-tenant operations remain visually and behaviorally distinct from business workspaces.
      </p>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Alert title="All core services operational" tone="success">
          Demonstration status until production observability is connected.
        </Alert>
        <Card title="Tenant access boundary">
          <p className="leading-7 text-[var(--text-secondary)]">
            Platform operators must explicitly select and justify tenant support access. This shell never
            impersonates tenant branding.
          </p>
        </Card>
      </div>
    </div>
  );
}
