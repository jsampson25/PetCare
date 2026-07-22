import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import {
  publishWebsite,
  requestCustomDomain,
  saveWebsiteDraft,
  unpublishWebsite,
  uploadWebsiteMedia,
} from './actions';
import {
  defaultWebsiteSections,
  WebsiteSectionEditor,
  type WebsiteSection,
} from './website-section-editor';
import { WebsiteCustomPagesEditor, type WebsiteCustomPage } from './website-custom-pages-editor';
import { WebsiteMediaEditor, type WebsiteMedia } from './website-media-editor';
import { WebsiteStylePicker } from './website-style-picker';
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
    { data: media },
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
    supabase
      .from('tenant_website_media')
      .select('id,object_path,alt_text,caption,category')
      .eq('business_id', context.businessId)
      .order('created_at', { ascending: false }),
  ]);
  const c = (site?.draft_content ?? {}) as Record<string, unknown>;
  const b = (site?.brand_tokens ?? {}) as Record<string, unknown>;
  const faq = Array.isArray(c.faqs) ? (c.faqs[0] as Record<string, string> | undefined) : undefined;
  const storedSections = Array.isArray(c.section_layout)
    ? (c.section_layout as WebsiteSection[])
    : defaultWebsiteSections;
  const customPages = Array.isArray(c.custom_pages) ? (c.custom_pages as WebsiteCustomPage[]) : [];
  const heroMedia = c.hero_media as { id?: string } | undefined;
  const mediaWithUrls: WebsiteMedia[] = (media ?? []).map((item) => ({
    ...item,
    publicUrl: supabase.storage.from('tenant-website-media').getPublicUrl(item.object_path).data
      .publicUrl,
  }));
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
      <Card
        title="Media library"
        description="Upload photos once, then drag or reuse them throughout your website."
      >
        <form
          action={uploadWebsiteMedia}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_.7fr_auto] lg:items-end"
          encType="multipart/form-data"
        >
          <Field
            accept="image/jpeg,image/png,image/webp"
            label="Photo"
            name="photo"
            required
            type="file"
          />
          <Field
            hint="Describe what is visible for accessibility."
            label="Alt text"
            name="altText"
            placeholder="Golden retriever playing outside"
            required
          />
          <label className="text-sm font-bold">
            Category
            <select
              className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-white px-3"
              defaultValue="pets"
              name="category"
            >
              <option value="pets">Pets</option>
              <option value="family">Families</option>
              <option value="staff">Staff</option>
              <option value="facility">Facility</option>
              <option value="grooming">Grooming</option>
              <option value="brand">Brand</option>
              <option value="general">General</option>
            </select>
          </label>
          <input name="caption" type="hidden" value="" />
          <Button type="submit">Upload photo</Button>
        </form>
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          JPG, PNG, or WebP up to 10 MB. Use only images you have permission to publish.
        </p>
      </Card>
      <Card title="Draft content" description={`Live status: ${site?.status ?? 'not configured'}`}>
        <form action={saveWebsiteDraft} className="grid gap-4 sm:grid-cols-2">
          <WebsiteStylePicker
            initialStyle={site?.theme_key ?? 'modern'}
            initialTemplate={String(c.template_key ?? 'studio-split')}
          />
          <WebsiteSectionEditor initialSections={storedSections} />
          <WebsiteMediaEditor initialHeroMediaId={heroMedia?.id ?? ''} media={mediaWithUrls} />
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
