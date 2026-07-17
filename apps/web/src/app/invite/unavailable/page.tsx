import { Card } from '@petcare/ui/card';
import Link from 'next/link';

export default function UnavailableInvitationPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-subtle)] px-4 py-10">
      <Card className="w-full max-w-lg" title="Invitation unavailable">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">This invitation cannot be accepted. Ask the business owner to create a new one.</p>
        <Link className="mt-5 inline-block font-bold underline" href="/auth/sign-in">Go to sign in</Link>
      </Card>
    </main>
  );
}
