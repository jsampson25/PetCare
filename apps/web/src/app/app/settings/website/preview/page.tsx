import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
export const metadata = { robots: { index: false, follow: false } };
export default async function PreviewPage() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_tenant_website_draft_preview', {
    target_business_id: context.businessId,
  });
  if (!data) return <Card title="No draft">Save website content before previewing.</Card>;
  const c = data.content as Record<string, unknown>;
  return (
    <main className="min-h-screen bg-white p-6 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <p className="rounded-lg bg-amber-100 p-3 text-center font-bold text-amber-950">
          Private draft preview · not published or indexable
        </p>
        <h1 className="mt-16 text-5xl font-black">{String(c.hero_title)}</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">{String(c.hero_body)}</p>
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <Card title="About">
            <p>{String(c.about)}</p>
          </Card>
          <Card title="Policies">
            <p>{String(c.policies)}</p>
          </Card>
        </div>
      </div>
    </main>
  );
}
