import { ButtonLink } from '@petcare/ui/button-link';
import { StatePanel } from '@petcare/ui/state-panel';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <StatePanel
        action={<ButtonLink href="/">Return home</ButtonLink>}
        description="The page may have moved, or you may not have access to it. No private record details were disclosed."
        title="Page not found"
      />
    </main>
  );
}
