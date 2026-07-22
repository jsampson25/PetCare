export const dynamic = 'force-dynamic';

function describeSupabaseUrl(value: string | undefined) {
  if (!value) return { host: 'missing', path: 'missing', status: 'missing' };

  try {
    const url = new URL(value);
    const isLocal = ['127.0.0.1', 'localhost'].includes(url.hostname);
    const hasExpectedHost = isLocal || url.hostname.endsWith('.supabase.co');
    const hasExpectedPath = url.pathname === '/' || url.pathname === '';
    return {
      host: url.hostname,
      path: url.pathname,
      status: hasExpectedHost && hasExpectedPath ? 'valid format' : 'invalid format',
    };
  } catch {
    return { host: 'invalid URL', path: 'invalid URL', status: 'invalid format' };
  }
}

export function GET() {
  const supabaseUrl = describeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const applicationUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);

  return Response.json(
    {
      configuration: {
        applicationUrl: applicationUrlConfigured ? 'configured' : 'request-host fallback',
        supabase: supabaseConfigured ? 'configured' : 'missing',
        supabaseUrl,
      },
      service: 'petcare-web',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
