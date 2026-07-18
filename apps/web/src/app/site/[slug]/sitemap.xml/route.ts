import { createSupabaseServerClient } from '../../../../lib/supabase/server';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_public_tenant_website', { public_slug_value: slug });
  if (!data) return new Response('Not found', { status: 404 });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${base}/site/${slug}`;
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url}</loc></url></urlset>`,
    { headers: { 'content-type': 'application/xml' } },
  );
}
