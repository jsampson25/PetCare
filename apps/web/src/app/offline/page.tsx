import { StatePanel } from '@petcare/ui/state-panel';

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <StatePanel
        description="Reconnect before viewing current care information or recording work. Safety-critical actions are never presented as saved while offline."
        title="You appear to be offline"
      />
    </main>
  );
}
