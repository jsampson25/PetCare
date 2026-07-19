'use server';

import { cookies } from 'next/headers';
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
    password.data !== confirmation
  ) {
    redirect(
      messageUrl(
        '/auth/register',
        'error',
        'Check your details. Passwords must match and contain at least 12 characters.',
      ),
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      data: {
        display_name: displayName.data,
        requested_plan: requestedPlan,
        requested_trial_days: requestedTrialDays,
      },
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error)
    redirect(
      messageUrl(
        '/auth/register',
        'error',
        'Registration could not be completed. Please try again.',
      ),
    );
  redirect(messageUrl('/auth/check-email', 'notice', 'Check your email to verify your account.'));
}

export async function requestPasswordReset(formData: FormData) {
  const email = emailSchema.safeParse(field(formData, 'email'));
  if (email.success) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required.');
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
