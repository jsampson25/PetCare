import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';

import { AuthCard } from '../../../components/auth-card';
import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyMfaCode } from './actions';
import { MfaEnrollmentForm } from './enrollment-form';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function MfaPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const next = getSafeRedirect(typeof parameters.next === 'string' ? parameters.next : undefined);
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect(`/auth/sign-in?next=${encodeURIComponent(`/auth/mfa?next=${next}`)}`);

  const [{ data: assurance }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assurance?.currentLevel === 'aal2') redirect(next);
  const verifiedFactor = factors?.totp.find((factor) => factor.status === 'verified');

  return (
    <AuthCard error={error} title={verifiedFactor ? 'Security check' : 'Protect your account'}>
      {verifiedFactor ? (
        <form action={verifyMfaCode} className="space-y-5">
          <p className="text-sm leading-6 text-[var(--text-secondary)]">Enter the current code from your authenticator app.</p>
          <input name="factorId" type="hidden" value={verifiedFactor.id} />
          <input name="next" type="hidden" value={next} />
          <Field autoComplete="one-time-code" autoFocus inputMode="numeric" label="Six-digit code" maxLength={6} name="code" pattern="[0-9]{6}" required />
          <Button type="submit">Verify and continue</Button>
        </form>
      ) : <MfaEnrollmentForm next={next} />}
    </AuthCard>
  );
}
