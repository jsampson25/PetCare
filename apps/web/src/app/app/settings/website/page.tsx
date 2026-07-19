import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { publishWebsite, requestCustomDomain, saveWebsiteDraft, unpublishWebsite } from './actions';
import {
  defaultWebsiteSections,
  WebsiteSectionEditor,
  type WebsiteSection,
} from './website-section-editor';
import { WebsiteCustomPagesEditor, type WebsiteCustomPage } from './website-custom-pages-editor';
type SP = Promise<Record<string, string | string[] | undefined>>;
export default async function WebsiteSettingsPage({ searchParams }: { searchParams: SP }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const q = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [
    { data: site },
    { data: versions },
    { data: business },
    { data: readiness },
    { data: domains },
  ] = await Promise.all([
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
    supabase.rpc('get_tenant_website_readiness', { target_business_id: context.businessId }),
    supabase
      .from('tenant_domain_bindings')
      .select('id,hostname,status,verification_token,last_checked_at,last_result')
      .eq('business_id', context.businessId)
      .order('requested_at', { ascending: false }),
  ]);
  const c = (site?.draft_content ?? {}) as Record<string, unknown>;
  const b = (site?.brand_tokens ?? {}) as Record<string, unknown>;
  const faq = Array.isArray(c.faqs) ? (c.faqs[0] as Record<string, string> | undefined) : undefined;
  const storedSections = Array.isArray(c.section_layout)
    ? (c.section_layout as WebsiteSection[])
    : defaultWebsiteSections;
  const customPages = Array.isArray(c.custom_pages) ? (c.custom_pages as WebsiteCustomPage[]) : [];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Customer website</p>
        <h1 className="mt-2 text-3xl font-black">Website editor</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Choose a complete site layout, apply your brand, preview every customer-facing surface,
          and publish when it is ready.
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
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-black">Choose your site layout</legend>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Each layout changes the logo, navigation, hero, and page composition. Your colors and
              identity also carry into booking and the customer portal.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {[
                {
                  key: 'modern',
                  name: 'Clean centered',
                  description: 'Centered logo and an editorial, premium presentation.',
                  preview: 'centered',
                },
                {
                  key: 'classic',
                  name: 'Classic left',
                  description: 'Familiar left-aligned brand with clear navigation.',
                  preview: 'left',
                },
                {
                  key: 'warm',
                  name: 'Modern split',
                  description: 'Balanced brand, navigation, and booking action.',
                  preview: 'split',
                },
              ].map((theme) => (
                <label
                  className="group cursor-pointer rounded-2xl border border-[var(--border-default)] bg-white p-3 has-[:checked]:border-[var(--action-primary)] has-[:checked]:ring-2 has-[:checked]:ring-[var(--action-primary)]/15"
                  key={theme.key}
                >
                  <input
                    className="sr-only"
                    defaultChecked={(site?.theme_key ?? 'modern') === theme.key}
                    name="theme"
                    type="radio"
                    value={theme.key}
                  />
                  <span className="block overflow-hidden rounded-xl border bg-[#fafafa]">
                    <span
                      className={`grid min-h-14 items-center gap-2 border-b bg-white px-3 ${theme.preview === 'centered' ? 'grid-cols-3' : 'grid-cols-[auto_1fr_auto]'}`}
                    >
                      {theme.preview === 'centered' ? (
                        <span className="h-1 w-12 bg-slate-200" />
                      ) : null}
                      <span
                        className={`${theme.preview === 'centered' ? 'justify-self-center' : ''} size-7 rounded-lg bg-[var(--action-primary)]`}
                      />
                      <span className="flex justify-end gap-1">
                        <span className="h-1 w-6 bg-slate-200" />
                        <span className="h-1 w-6 bg-slate-200" />
                      </span>
                    </span>
                    <span className="grid min-h-28 place-items-center p-4 text-center">
                      <span>
                        <span className="mx-auto block h-2 w-28 rounded bg-slate-800" />
                        <span className="mx-auto mt-2 block h-1.5 w-36 rounded bg-slate-200" />
                        <span className="mx-auto mt-3 block h-6 w-16 rounded-md bg-[var(--action-primary)]" />
                      </span>
                    </span>
                  </span>
                  <span className="mt-3 block font-black">{theme.name}</span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">
                    {theme.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <WebsiteSectionEditor initialSections={storedSections} />
          <WebsiteCustomPagesEditor initialPages={customPages} />
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
      <Card
        title="Custom domain"
        description="The platform subdomain remains available while DNS ownership and TLS are verified."
      >
        <form action={requestCustomDomain} className="flex flex-wrap items-end gap-3">
          <Field label="Hostname" name="hostname" placeholder="www.example.com" required />
          <Button type="submit">Request verification</Button>
        </form>
        {domains?.length ? (
          <div className="mt-5 grid gap-3">
            {domains.map((domain) => (
              <div className="rounded-lg border p-4" key={domain.id}>
                <p className="font-black">
                  {domain.hostname} · {domain.status.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 break-all font-mono text-xs">
                  Create a DNS TXT record: {domain.verification_token}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Verification is performed by the platform worker; the website editor cannot
                  self-approve domain ownership.
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="Preview & publish">
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          {Object.entries((readiness ?? {}) as Record<string, boolean>).map(([key, ready]) => (
            <span
              className={`rounded-full px-3 py-1 font-bold ${ready ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}
              key={key}
            >
              {key}: {ready ? 'ready' : 'needs work'}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/app/settings/website/preview" variant="secondary">
            Preview draft
          </ButtonLink>
          <ButtonLink href={`/site/${business?.public_slug ?? ''}`} variant="secondary">
            View live site
          </ButtonLink>
          {context.permissions.has('website.publish') ? (
            <form action={publishWebsite}>
              <input name="sourcePublicationId" type="hidden" value="" />
              <Button type="submit">Publish draft</Button>
            </form>
          ) : null}
          {site?.status === 'published' && context.permissions.has('website.publish') ? (
            <form action={unpublishWebsite}>
              <Button type="submit" variant="secondary">
                Unpublish
              </Button>
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
