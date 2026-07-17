export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
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
