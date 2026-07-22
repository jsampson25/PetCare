export const dynamic = 'force-dynamic';

export function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const applicationUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);

  return Response.json(
    {
      configuration: {
        applicationUrl: applicationUrlConfigured ? 'configured' : 'request-host fallback',
        supabase: supabaseConfigured ? 'configured' : 'missing',
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
