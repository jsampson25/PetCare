import { ButtonLink } from '@petcare/ui/button-link';
import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import { Card } from '@petcare/ui/card';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { submitInquiry } from './actions';
type Site = {
  business: { name: string; slug: string };
  brand_tokens: { primary: string; accent: string };
  content: Record<string, unknown>;
  services: Array<{ name: string; description: string | null; category: string }>;
  locations: Array<{ name: string; time_zone: string }>;
  seo: { title: string; description: string };
};
async function getSite(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_public_tenant_website', { public_slug_value: slug });
  return data as Site | null;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const site = await getSite((await params).slug);
  return site
    ? {
        title: site.seo.title,
        description: site.seo.description,
        robots: { index: true, follow: true },
      }
    : { title: 'Site unavailable', robots: { index: false, follow: false } };
}
export default async function TenantSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getSite((await params).slug);
  const query = await searchParams;
  if (!site) notFound();
  const c = site.content;
  const faqs = Array.isArray(c.faqs) ? (c.faqs as Array<{ question: string; answer: string }>) : [];
  return (
    <main
      className="min-h-screen bg-white text-slate-950"
      style={
        {
          '--tenant-primary': site.brand_tokens.primary,
          '--tenant-accent': site.brand_tokens.accent,
        } as CSSProperties
      }
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <strong className="text-xl">{site.business.name}</strong>
        <nav className="flex gap-4 text-sm font-bold">
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p
          className="font-black uppercase tracking-widest"
          style={{ color: 'var(--tenant-primary)' }}
        >
          Thoughtful pet care
        </p>
        <h1 className="mt-4 max-w-4xl text-5xl font-black tracking-tight">
          {String(c.hero_title)}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{String(c.hero_body)}</p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href={`/book?tenant=${site.business.slug}`}>Book now</ButtonLink>
          <ButtonLink href="/portal" variant="secondary">
            Customer portal
          </ButtonLink>
        </div>
      </section>
      <section className="bg-slate-50 py-16" id="services">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-black">Services</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {site.services.map((service) => (
              <Card key={service.name} title={service.name} description={service.category}>
                <p>{service.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2" id="about">
        <div>
          <h2 className="text-3xl font-black">About us</h2>
          <p className="mt-5 leading-8 text-slate-600">{String(c.about)}</p>
        </div>
        <div>
          <h2 className="text-3xl font-black">Frequently asked questions</h2>
          {faqs.map((faq) => (
            <details className="mt-4 rounded-lg border p-4" key={faq.question}>
              <summary className="font-bold">{faq.question}</summary>
              <p className="mt-3 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="bg-slate-950 py-16 text-white" id="contact">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black">Contact</h2>
            <p className="mt-4">
              {String(c.contact_email)} · {String(c.contact_phone)}
            </p>
            {site.locations.map((location) => (
              <p className="mt-2" key={location.name}>
                {location.name}
              </p>
            ))}
          </div>
          <form
            action={submitInquiry}
            className="grid gap-3 rounded-xl bg-white p-5 text-slate-950"
          >
            <h2 className="text-2xl font-black">Send an inquiry</h2>
            {typeof query.notice === 'string' ? (
              <p className="font-bold text-green-700">{query.notice}</p>
            ) : null}
            {typeof query.error === 'string' ? (
              <p className="font-bold text-red-700">{query.error}</p>
            ) : null}
            <input name="slug" type="hidden" value={site.business.slug} />
            <input className="hidden" name="website" tabIndex={-1} />
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" required type="email" />
            <Field label="Phone" name="phone" />
            <label className="text-sm font-bold">
              How can we help?
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border p-3"
                name="message"
                required
              />
            </label>
            <label className="flex gap-3 text-sm">
              <input name="consent" required type="checkbox" value="yes" />I agree that this
              business may respond to my inquiry.
            </label>
            <Button type="submit">Send message</Button>
          </form>
          <div>
            <h2 className="text-2xl font-black">Policies</h2>
            <p className="mt-4 leading-7 text-slate-300">{String(c.policies)}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
