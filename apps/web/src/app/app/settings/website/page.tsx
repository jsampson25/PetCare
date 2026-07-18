import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { publishWebsite, saveWebsiteDraft } from './actions';
type SP = Promise<Record<string, string | string[] | undefined>>;
export default async function WebsiteSettingsPage({ searchParams }: { searchParams: SP }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const q = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: site }, { data: versions }, { data: business }] = await Promise.all([
    supabase
      .from('tenant_websites')
      .select('id,status,theme_key,brand_tokens,draft_content,current_publication_number')
      .eq('business_id', context.businessId)
      .maybeSingle(),
    supabase
      .from('tenant_website_publications')
      .select('id,publication_number,published_at')
      .eq('business_id', context.businessId)
      .order('publication_number', { ascending: false }),
    supabase.from('businesses').select('public_slug').eq('id', context.businessId).single(),
  ]);
  const c = (site?.draft_content ?? {}) as Record<string, unknown>;
  const b = (site?.brand_tokens ?? {}) as Record<string, unknown>;
  const faq = Array.isArray(c.faqs) ? (c.faqs[0] as Record<string, string> | undefined) : undefined;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Customer website</p>
        <h1 className="mt-2 text-3xl font-black">Website editor</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Edit a governed light theme, preview safely, and publish an immutable version.
        </p>
      </header>
      {typeof q.notice === 'string' ? (
        <Alert title="Website updated" tone="success">
          {q.notice}
        </Alert>
      ) : null}
      {typeof q.error === 'string' ? (
        <Alert title="Website unavailable" tone="danger">
          {q.error}
        </Alert>
      ) : null}
      <Card title="Draft content" description={`Live status: ${site?.status ?? 'not configured'}`}>
        <form action={saveWebsiteDraft} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Theme
            <select
              className="mt-2 min-h-12 w-full rounded-lg border px-3"
              defaultValue={site?.theme_key ?? 'modern'}
              name="theme"
            >
              <option value="modern">Modern</option>
              <option value="warm">Warm</option>
              <option value="classic">Classic</option>
            </select>
          </label>
          <Field
            defaultValue={String(b.primary ?? '#23664f')}
            label="Primary color"
            name="primary"
            type="color"
          />
          <Field
            defaultValue={String(b.accent ?? '#d97745')}
            label="Accent color"
            name="accent"
            type="color"
          />
          <Field
            defaultValue={String(c.hero_title ?? '')}
            label="Homepage headline"
            name="heroTitle"
            required
          />
          <label className="text-sm font-bold sm:col-span-2">
            Homepage introduction
            <textarea
              className="mt-2 min-h-24 w-full rounded-lg border p-3"
              defaultValue={String(c.hero_body ?? '')}
              name="heroBody"
              required
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            About us
            <textarea
              className="mt-2 min-h-32 w-full rounded-lg border p-3"
              defaultValue={String(c.about ?? '')}
              name="about"
              required
            />
          </label>
          <Field
            defaultValue={faq?.question ?? ''}
            label="FAQ question"
            name="faqQuestion"
            required
          />
          <Field defaultValue={faq?.answer ?? ''} label="FAQ answer" name="faqAnswer" required />
          <label className="text-sm font-bold sm:col-span-2">
            Policies summary
            <textarea
              className="mt-2 min-h-24 w-full rounded-lg border p-3"
              defaultValue={String(c.policies ?? '')}
              name="policies"
              required
            />
          </label>
          <Field
            defaultValue={String(c.contact_email ?? '')}
            label="Public email"
            name="contactEmail"
            required
            type="email"
          />
          <Field
            defaultValue={String(c.contact_phone ?? '')}
            label="Public phone"
            name="contactPhone"
            required
          />
          <Field defaultValue={String(c.seo_title ?? '')} label="SEO title" name="seoTitle" />
          <Field
            defaultValue={String(c.seo_description ?? '')}
            label="SEO description"
            name="seoDescription"
          />
          <div className="sm:col-span-2">
            <Button type="submit">Save draft</Button>
          </div>
        </form>
      </Card>
      <Card title="Preview & publish">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/site/${business?.public_slug ?? ''}`} variant="secondary">
            View live site
          </ButtonLink>
          {context.permissions.has('website.publish') ? (
            <form action={publishWebsite}>
              <input name="sourcePublicationId" type="hidden" value="" />
              <Button type="submit">Publish draft</Button>
            </form>
          ) : null}
        </div>
        {versions?.length ? (
          <div className="mt-5 grid gap-2">
            {versions.map((version) => (
              <form
                action={publishWebsite}
                className="flex items-center justify-between rounded-lg border p-3"
                key={version.id}
              >
                <input name="sourcePublicationId" type="hidden" value={version.id} />
                <span>
                  Version {version.publication_number} ·{' '}
                  {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                    new Date(version.published_at),
                  )}
                </span>
                <Button type="submit" variant="secondary">
                  Rollback
                </Button>
              </form>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
