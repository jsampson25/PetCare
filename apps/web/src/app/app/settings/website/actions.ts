'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
export async function saveWebsiteDraft(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const websiteSectionSchema = z.object({
    id: z.enum(['services', 'about', 'faq', 'contact']),
    visible: z.boolean(),
  });
  const customPageSchema = z.object({
    id: z.uuid(),
    title: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .refine((slug) => !['book', 'portal', 'services', 'contact'].includes(slug)),
    body: z.string().trim().min(1).max(10000),
    showInNavigation: z.boolean(),
  });
  const raw = Object.fromEntries(formData);
  const sectionLayout = z
    .array(websiteSectionSchema)
    .length(4)
    .refine((sections) => new Set(sections.map((section) => section.id)).size === 4)
    .safeParse(
      typeof raw.sectionLayout === 'string'
        ? (() => {
            try {
              return JSON.parse(raw.sectionLayout);
            } catch {
              return null;
            }
          })()
        : null,
    );
  const customPages = z
    .array(customPageSchema)
    .max(10)
    .refine((pages) => new Set(pages.map((page) => page.slug)).size === pages.length)
    .safeParse(
      typeof raw.customPages === 'string'
        ? (() => {
            try {
              return JSON.parse(raw.customPages);
            } catch {
              return null;
            }
          })()
        : null,
    );
  const parsed = z
    .object({
      theme: z.enum(['modern', 'warm', 'classic']),
      primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      heroTitle: z.string().trim().min(5).max(120),
      heroBody: z.string().trim().min(12).max(500),
      about: z.string().trim().min(12).max(3000),
      faqQuestion: z.string().trim().min(3).max(200),
      faqAnswer: z.string().trim().min(8).max(1000),
      policies: z.string().trim().min(8).max(3000),
      contactEmail: z.email(),
      contactPhone: z.string().trim().min(7).max(30),
      seoTitle: z.string().trim().max(70),
      seoDescription: z.string().trim().max(170),
    })
    .safeParse(raw);
  if (!parsed.success || !sectionLayout.success || !customPages.success)
    redirect('/app/settings/website?error=Complete+the+required+website+content.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_tenant_website_draft', {
    target_business_id: context.businessId,
    theme_value: parsed.data.theme,
    brand_value: { primary: parsed.data.primary, accent: parsed.data.accent },
    content_value: {
      hero_title: parsed.data.heroTitle,
      hero_body: parsed.data.heroBody,
      about: parsed.data.about,
      faqs: [{ question: parsed.data.faqQuestion, answer: parsed.data.faqAnswer }],
      policies: parsed.data.policies,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone,
      seo_title: parsed.data.seoTitle,
      seo_description: parsed.data.seoDescription,
      section_layout: sectionLayout.data,
      custom_pages: customPages.data,
    },
  });
  if (error) redirect('/app/settings/website?error=Website+draft+could+not+be+saved.');
  redirect('/app/settings/website?notice=Draft+saved.');
}
export async function publishWebsite(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.publish')) redirect('/denied');
  const source = z
    .union([z.literal(''), z.uuid()])
    .safeParse(formData.get('sourcePublicationId') ?? '');
  if (!source.success) redirect('/app/settings/website?error=Publication+is+invalid.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('publish_tenant_website', {
    target_business_id: context.businessId,
    source_publication_value: source.data || null,
  });
  if (error) redirect('/app/settings/website?error=Publishing+readiness+checks+failed.');
  redirect('/app/settings/website?notice=Website+published.');
}
export async function unpublishWebsite() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.publish')) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('unpublish_tenant_website', {
    target_business_id: context.businessId,
  });
  if (error) redirect('/app/settings/website?error=Live+website+could+not+be+unpublished.');
  redirect(
    '/app/settings/website?notice=Website+unpublished.+Portal+and+bookings+remain+available.',
  );
}
export async function requestCustomDomain(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.publish')) redirect('/denied');
  const hostname = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+$/)
    .safeParse(formData.get('hostname'));
  if (!hostname.success) redirect('/app/settings/website?error=Enter+a+valid+hostname.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('request_tenant_custom_domain', {
    target_business_id: context.businessId,
    hostname_value: hostname.data,
  });
  if (error) redirect('/app/settings/website?error=That+hostname+cannot+be+requested.');
  redirect('/app/settings/website?notice=Domain+verification+requested.');
}
