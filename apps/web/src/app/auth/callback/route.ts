import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const supportedOtpTypes = new Set<EmailOtpType>([
  'email', 'email_change', 'invite', 'magiclink', 'recovery', 'signup',
]);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const next = getSafeRedirect(request.nextUrl.searchParams.get('next'));
  const supabase = await createSupabaseServerClient();

  let error: Error | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && supportedOtpTypes.has(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error('Missing verification parameters');
  }

  if (error) {
    const failure = new URL('/auth/sign-in', request.url);
    failure.searchParams.set('error', 'This account link is invalid or expired.');
    return NextResponse.redirect(failure);
  }
  return NextResponse.redirect(new URL(next, request.url));
}
