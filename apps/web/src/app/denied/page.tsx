import { ButtonLink } from '@petcare/ui/button-link';
import { StatePanel } from '@petcare/ui/state-panel';

export default function DeniedPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <StatePanel
        action={<ButtonLink href="/">Return home</ButtonLink>}
        description="Your current account does not have permission to use this area. Ask a business owner if you believe this is incorrect."
        title="Access unavailable"
      />
    </main>
  );
}
