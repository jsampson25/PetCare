'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const websiteMediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxWebsiteMediaBytes = 10 * 1024 * 1024;

export async function uploadWebsiteMedia(formData: FormData) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const photo = formData.get('photo');
  const details = z
    .object({
      altText: z.string().trim().min(3).max(240),
      caption: z.string().trim().max(500),
      category: z.enum(['general', 'pets', 'family', 'staff', 'facility', 'grooming', 'brand']),
    })
    .safeParse(Object.fromEntries(formData));
  if (
    !details.success ||
    !(photo instanceof File) ||
    photo.size < 1 ||
    photo.size > maxWebsiteMediaBytes ||
    !websiteMediaTypes.has(photo.type)
  ) {
    redirect(
      '/app/settings/website?error=Choose+a+JPG,+PNG,+or+WebP+image+under+10+MB+and+add+descriptive+alt+text.',
    );
  }

  const extension =
    photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${context.businessId}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from('tenant-website-media')
    .upload(objectPath, photo, { contentType: photo.type, upsert: false });
  if (uploadError) redirect('/app/settings/website?error=The+website+photo+could+not+be+uploaded.');

  const { error } = await supabase.schema('app').rpc('record_tenant_website_media', {
    alt_text_value: details.data.altText,
    byte_size_value: photo.size,
    caption_value: details.data.caption,
    category_value: details.data.category,
    mime_type_value: photo.type,
    object_path_value: objectPath,
    original_file_name_value: photo.name,
    target_business_id: context.businessId,
  });
  if (error) {
    await supabase.storage.from('tenant-website-media').remove([objectPath]);
    redirect('/app/settings/website?error=The+website+photo+could+not+be+saved.');
  }
  redirect('/app/settings/website?notice=Photo+added+to+your+media+library.');
}

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
      template: z.enum([
        'studio-split',
        'centered-studio',
        'modern-editorial',
        'happy-tails',
        'pet-parade',
        'neighborhood',
        'heritage',
        'lodge',
        'professional',
      ]),
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
      heroMediaId: z.union([z.literal(''), z.uuid()]),
    })
    .safeParse(raw);
  if (!parsed.success || !sectionLayout.success || !customPages.success)
    redirect('/app/settings/website?error=Complete+the+required+website+content.');
  const templatesByTheme = {
    modern: new Set(['studio-split', 'centered-studio', 'modern-editorial']),
    warm: new Set(['happy-tails', 'pet-parade', 'neighborhood']),
    classic: new Set(['heritage', 'lodge', 'professional']),
  };
  if (!templatesByTheme[parsed.data.theme].has(parsed.data.template))
    redirect('/app/settings/website?error=Choose+a+template+from+the+selected+style.');
  const supabase = await createSupabaseServerClient();
  const heroMedia = parsed.data.heroMediaId
    ? await supabase
        .from('tenant_website_media')
        .select('id,object_path,alt_text,caption')
        .eq('business_id', context.businessId)
        .eq('id', parsed.data.heroMediaId)
        .maybeSingle()
    : { data: null, error: null };
  if (heroMedia.error || (parsed.data.heroMediaId && !heroMedia.data))
    redirect('/app/settings/website?error=Choose+a+photo+from+your+website+media+library.');
  const { error } = await supabase.schema('app').rpc('save_tenant_website_draft', {
    target_business_id: context.businessId,
    theme_value: parsed.data.theme,
    brand_value: { primary: parsed.data.primary, accent: parsed.data.accent },
    content_value: {
      hero_title: parsed.data.heroTitle,
      template_key: parsed.data.template,
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
      hero_media: heroMedia.data,
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
  const { error } = await supabase.schema('app').rpc('publish_tenant_website', {
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
  const { error } = await supabase.schema('app').rpc('unpublish_tenant_website', {
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
