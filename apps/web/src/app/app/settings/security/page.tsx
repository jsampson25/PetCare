import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { getSessionSummary } from '../../../../lib/auth/session-summary';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { signOutEverywhere, signOutOtherSessions } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/select-business');
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : undefined;
  const supabase = await createSupabaseServerClient();
  const [{ data: assurance }, { data: factors }, { data: claimsData }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
    supabase.auth.getClaims(),
  ]);
  const verifiedFactors = factors?.totp.filter((factor) => factor.status === 'verified') ?? [];
  const session = getSessionSummary((claimsData?.claims ?? {}) as Record<string, unknown>);
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Settings</p>
        <h1 className="text-3xl font-black tracking-tight">Account security</h1>
      </header>
      {error ? (
        <Alert title="Session action failed" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert title="Session updated" tone="success">
          {notice}
        </Alert>
      ) : null}
      {context.requiresMfa ? (
        <Alert title="MFA required" tone="info">
          Your assigned role requires a verified authenticator whenever you access this business.
        </Alert>
      ) : null}
      <Card
        description="Authenticator factors are managed by the identity provider. PetCare never stores their secrets."
        title="Multi-factor authentication"
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-bold">Current session</dt>
            <dd>{assurance?.currentLevel === 'aal2' ? 'MFA verified' : 'Password verified'}</dd>
          </div>
          <div>
            <dt className="font-bold">Verified authenticators</dt>
            <dd>{verifiedFactors.length}</dd>
          </div>
        </dl>
        <Link
          className="mt-5 inline-block font-bold underline"
          href="/auth/mfa?next=/app/settings/security"
        >
          {verifiedFactors.length ? 'Verify this session again' : 'Set up an authenticator'}
        </Link>
      </Card>
      <Card
        description="Review this session or revoke access on other devices. PetCare never displays or stores session tokens."
        title="Sessions"
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-bold">Authentication</dt>
            <dd>{session.assurance}</dd>
          </div>
          <div>
            <dt className="font-bold">Current token issued</dt>
            <dd>{session.issuedAt ? dateFormatter.format(session.issuedAt) : 'Current session'}</dd>
          </div>
          <div>
            <dt className="font-bold">Access token refresh by</dt>
            <dd>
              {session.expiresAt ? dateFormatter.format(session.expiresAt) : 'Managed securely'}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={signOutOtherSessions}>
            <Button type="submit" variant="secondary">
              Sign out other devices
            </Button>
          </form>
          <form action={signOutEverywhere}>
            <Button type="submit" variant="danger">
              Sign out everywhere
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
