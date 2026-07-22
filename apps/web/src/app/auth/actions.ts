'use server';

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getSafeRedirect } from '../../lib/auth/safe-redirect';
import { businessContextCookie } from '../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../lib/supabase/server';

const emailSchema = z.email().max(320);
const passwordSchema = z.string().min(12).max(128);

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function messageUrl(path: string, kind: 'error' | 'notice', message: string) {
  const parameters = new URLSearchParams({ [kind]: message });
  return `${path}?${parameters.toString()}`;
}

async function getApplicationUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    const parsed = new URL(configuredUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.');
    }
    return parsed.origin;
  }

  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  const allowedHost =
    host === 'localhost:3000' ||
    host === 'getroventra.com' ||
    host === 'www.getroventra.com' ||
    host === 'beta.getroventra.com' ||
    host.endsWith('.vercel.app');
  if (!host || !allowedHost) throw new Error('A trusted application URL is required.');
  return `${host.startsWith('localhost:') ? 'http' : 'https'}://${host}`;
}

export async function signIn(formData: FormData) {
  const email = emailSchema.safeParse(field(formData, 'email'));
  const password = z.string().min(1).safeParse(field(formData, 'password'));
  const next = getSafeRedirect(field(formData, 'next'));
  if (!email.success || !password.success) {
    redirect(messageUrl('/auth/sign-in', 'error', 'Enter a valid email and password.'));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  if (error)
    redirect(messageUrl('/auth/sign-in', 'error', 'Email or password was not recognized.'));
  redirect(next);
}

export async function register(formData: FormData) {
  const email = emailSchema.safeParse(field(formData, 'email'));
  const password = passwordSchema.safeParse(field(formData, 'password'));
  const confirmation = field(formData, 'passwordConfirmation');
  const displayName = z.string().min(1).max(120).safeParse(field(formData, 'displayName'));
  const legalAccepted = formData.get('legalAccepted') === 'on';
  const requestedPlan = z
    .enum(['starter', 'growth', 'scale'])
    .catch('growth')
    .parse(field(formData, 'plan'));
  const requestedTrialDays =
    field(formData, 'trial') === '14' && requestedPlan !== 'scale' ? 14 : 0;
  const next = getSafeRedirect(field(formData, 'next'), '/auth/verified');
  if (
    !email.success ||
    !password.success ||
    !displayName.success ||
    !legalAccepted ||
    password.data !== confirmation
  ) {
    redirect(
      messageUrl(
        '/auth/register',
        'error',
        'Check your details, accept the Terms and Privacy Policy, and use matching passwords of at least 12 characters.',
      ),
    );
  }

  let appUrl: string;
  try {
    appUrl = await getApplicationUrl();
  } catch (error) {
    console.error('Registration application URL is unavailable.', error);
    redirect(
      messageUrl(
        '/auth/register',
        'error',
        'Registration is not configured for this website address yet.',
      ),
    );
  }

  let registrationError: string | undefined;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        data: {
          display_name: displayName.data,
          requested_plan: requestedPlan,
          requested_trial_days: requestedTrialDays,
          legal_accepted_at: new Date().toISOString(),
          terms_version: '2026-07-21',
          privacy_version: '2026-07-21',
        },
        emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      console.error('Supabase rejected registration.', { code: error.code, status: error.status });
      registrationError =
        error.code === 'over_email_send_rate_limit'
          ? 'Too many verification emails were requested. Wait a few minutes and try again.'
          : 'Registration could not be completed. Try another email address or try again later.';
    }
  } catch (error) {
    console.error('Registration service is unavailable.', error);
    registrationError =
      'The registration service is not configured correctly. Check the beta deployment settings.';
  }
  if (registrationError) {
    redirect(messageUrl('/auth/register', 'error', registrationError));
  }
  redirect(messageUrl('/auth/check-email', 'notice', 'Check your email to verify your account.'));
}

export async function requestPasswordReset(formData: FormData) {
  const email = emailSchema.safeParse(field(formData, 'email'));
  if (email.success) {
    const appUrl = await getApplicationUrl();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
    });
  }
  redirect(
    messageUrl(
      '/auth/check-email',
      'notice',
      'If an account exists, a password reset link has been sent.',
    ),
  );
}

export async function updatePassword(formData: FormData) {
  const password = passwordSchema.safeParse(field(formData, 'password'));
  const confirmation = field(formData, 'passwordConfirmation');
  if (!password.success || password.data !== confirmation) {
    redirect(
      messageUrl(
        '/auth/update-password',
        'error',
        'Passwords must match and contain at least 12 characters.',
      ),
    );
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error)
    redirect(
      messageUrl(
        '/auth/update-password',
        'error',
        'This reset session is invalid or expired. Request a new link.',
      ),
    );
  await supabase.auth.signOut({ scope: 'global' });
  redirect(
    messageUrl('/auth/sign-in', 'notice', 'Password updated. Sign in again on your devices.'),
  );
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(businessContextCookie);
  redirect(messageUrl('/auth/sign-in', 'notice', 'You have been signed out.'));
}
