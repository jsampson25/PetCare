import { randomUUID } from 'node:crypto';

import { ButtonLink } from '@petcare/ui/button-link';
import { StatePanel } from '@petcare/ui/state-panel';
import type { Metadata } from 'next';

import { getSafeRedirect } from '../../lib/auth/safe-redirect';

export const metadata: Metadata = { robots: { follow: false, index: false }, title: 'Access unavailable' };

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function DeniedPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const reference = randomUUID();
  const returnTo = getSafeRedirect(
    typeof parameters.returnTo === 'string' ? parameters.returnTo : undefined,
    '/',
  );

  console.warn(JSON.stringify({
    event: 'authorization.denied_page_viewed',
    reference,
    timestamp: new Date().toISOString(),
  }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <StatePanel
        action={<ButtonLink href={returnTo}>Return to a safe page</ButtonLink>}
        description="Your current account cannot use this area. The requested information may be unavailable or you may need different access. Ask a business owner if this seems incorrect."
        title="Access unavailable"
      />
      <p className="mt-5 text-center text-xs text-[var(--text-secondary)]">Support reference: {reference}</p>
    </main>
  );
}
