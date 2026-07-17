import { Alert } from '@petcare/ui/alert';
import { Card } from '@petcare/ui/card';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export default async function SecuritySettingsPage() {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/select-business');
  const supabase = await createSupabaseServerClient();
  const [{ data: assurance }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const verifiedFactors = factors?.totp.filter((factor) => factor.status === 'verified') ?? [];

  return (
    <div className="space-y-6">
      <header><p className="text-sm font-bold text-[var(--text-secondary)]">Settings</p><h1 className="text-3xl font-black tracking-tight">Account security</h1></header>
      {context.requiresMfa ? <Alert title="MFA required" tone="info">Your assigned role requires a verified authenticator whenever you access this business.</Alert> : null}
      <Card description="Authenticator factors are managed by the identity provider. PetCare never stores their secrets." title="Multi-factor authentication">
        <dl className="space-y-3 text-sm">
          <div><dt className="font-bold">Current session</dt><dd>{assurance?.currentLevel === 'aal2' ? 'MFA verified' : 'Password verified'}</dd></div>
          <div><dt className="font-bold">Verified authenticators</dt><dd>{verifiedFactors.length}</dd></div>
        </dl>
        <Link className="mt-5 inline-block font-bold underline" href="/auth/mfa?next=/app/settings/security">
          {verifiedFactors.length ? 'Verify this session again' : 'Set up an authenticator'}
        </Link>
      </Card>
    </div>
  );
}
