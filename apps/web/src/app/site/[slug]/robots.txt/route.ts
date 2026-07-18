export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new Response(
    `User-agent: *\nAllow: /site/${slug}\nDisallow: /portal\nDisallow: /app\nSitemap: ${base}/site/${slug}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain' } },
  );
}
