'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export async function submitInquiry(formData: FormData) {
  const parsed = z
    .object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string().trim().min(2).max(120),
      email: z.email(),
      phone: z.string().trim().max(30),
      message: z.string().trim().min(10).max(3000),
      consent: z.literal('yes'),
      website: z.string().max(0),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(`/site/${String(formData.get('slug') ?? '')}?error=Complete+the+inquiry+and+consent.`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('submit_website_inquiry', {
    public_slug_value: parsed.data.slug,
    name_value: parsed.data.name,
    email_value: parsed.data.email,
    phone_value: parsed.data.phone,
    message_value: parsed.data.message,
    consent_value: true,
    source_value: `/site/${parsed.data.slug}`,
    honeypot_value: parsed.data.website,
    request_key: `inquiry-${crypto.randomUUID()}`,
  });
  if (error) redirect(`/site/${parsed.data.slug}?error=Inquiry+could+not+be+submitted.`);
  redirect(`/site/${parsed.data.slug}?notice=Thanks.+The+care+team+received+your+message.`);
}
