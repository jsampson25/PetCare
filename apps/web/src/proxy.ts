import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSafeRedirect } from './lib/auth/safe-redirect';

const protectedPrefixes = ['/app', '/onboarding', '/platform', '/portal'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const requiresAuthentication = protectedPrefixes.some(
    (prefix) =>
      request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );

  if (requiresAuthentication && !data?.claims?.sub) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    signInUrl.search = '';
    signInUrl.searchParams.set(
      'next',
      getSafeRedirect(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
