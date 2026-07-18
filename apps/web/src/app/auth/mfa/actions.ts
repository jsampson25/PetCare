'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export type MfaEnrollmentState = {
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

export async function beginMfaEnrollment(
  previousState: MfaEnrollmentState,
  formData: FormData,
): Promise<MfaEnrollmentState> {
  void previousState;
  void formData;

  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();

  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'PetCare authenticator',
  });
  if (error) return { error: 'Authenticator setup could not be started. Sign in again and retry.' };

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMfaCode(formData: FormData) {
  const factorId = z.uuid().safeParse(formData.get('factorId'));
  const code = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(formData.get('code'));
  const next = getSafeRedirect(
    typeof formData.get('next') === 'string' ? String(formData.get('next')) : undefined,
  );
  if (!factorId.success || !code.success) {
    redirect(
      `/auth/mfa?error=${encodeURIComponent('Enter the six-digit code from your authenticator app.')}&next=${encodeURIComponent(next)}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factorId.data,
  });
  if (challengeError) {
    redirect(
      `/auth/mfa?error=${encodeURIComponent('The security challenge could not be started. Try again.')}&next=${encodeURIComponent(next)}`,
    );
  }
  const { error } = await supabase.auth.mfa.verify({
    challengeId: challenge.id,
    code: code.data,
    factorId: factorId.data,
  });
  if (error) {
    redirect(
      `/auth/mfa?error=${encodeURIComponent('That code was not accepted. Wait for a new code and retry.')}&next=${encodeURIComponent(next)}`,
    );
  }
  redirect(next);
}
