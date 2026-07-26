import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Field } from '@petcare/ui/field';
import { validateTenantActionColor } from '@petcare/config/tenant-theme';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getWebsitePresentation } from '../../../lib/websites/presentation';
import { submitInquiry } from './actions';
import {
  defaultWebsiteSectionLayout,
  isWebsiteSectionLayout,
  websiteSectionCatalog,
  type WebsiteLayoutSectionId,
} from '../../app/settings/website/website-section-catalog';

type Site = {
  business: { name: string; slug: string };
  theme_key: 'modern' | 'warm' | 'classic';
  brand_tokens: { primary: string; primaryText?: string; accent: string };
  content: Record<string, unknown>;
  services: Array<{ name: string; description: string | null; category: string }>;
  locations: Array<{ name: string; time_zone: string }>;
  seo: { title: string; description: string };
};
type CustomPage = {
  id: string;
  title: string;
  slug: string;
  body: string;
  showInNavigation: boolean;
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
  const content = site.content;
  const faqs = Array.isArray(content.faqs)
    ? (content.faqs as Array<{ question: string; answer: string }>)
    : [];
  const sectionLayout = isWebsiteSectionLayout(content.section_layout)
    ? content.section_layout
    : defaultWebsiteSectionLayout;
  const customPages = Array.isArray(content.custom_pages)
    ? (content.custom_pages as CustomPage[])
    : [];
  const templateKey = String(content.template_key ?? 'studio-split');
  const presentation = getWebsitePresentation(site.theme_key, templateKey);
  const validatedPrimary = validateTenantActionColor(site.brand_tokens.primary);
  const primaryTextColor =
    typeof site.brand_tokens.primaryText === 'string'
      ? site.brand_tokens.primaryText
      : validatedPrimary.accepted
        ? validatedPrimary.actionTextColor
        : '#ffffff';
  const heroMedia = content.hero_media as
    { object_path?: string; alt_text?: string; caption?: string | null } | undefined;
  const logoMedia = content.logo_media as
    { object_path?: string; alt_text?: string; caption?: string | null } | undefined;
  const servicesMedia = content.services_media as
    { object_path?: string; alt_text?: string; caption?: string | null } | undefined;
  const aboutMedia = content.about_media as
    { object_path?: string; alt_text?: string; caption?: string | null } | undefined;
  const supabase = await createSupabaseServerClient();
  const mediaUrl = (objectPath?: string) =>
    objectPath
      ? supabase.storage.from('tenant-website-media').getPublicUrl(objectPath).data.publicUrl
      : null;
  const heroImageUrl = mediaUrl(heroMedia?.object_path);
  const logoImageUrl = mediaUrl(logoMedia?.object_path);
  const servicesImageUrl = mediaUrl(servicesMedia?.object_path);
  const aboutImageUrl = mediaUrl(aboutMedia?.object_path);
  const sectionStyle = (id: WebsiteLayoutSectionId): CSSProperties => ({
    display:
      sectionLayout.find((section) => section.id === id)?.visible === true ? undefined : 'none',
    order: Math.max(
      0,
      sectionLayout.findIndex((section) => section.id === id),
    ),
  });
  const centeredHeader = presentation.centered;
  const splitHeader = presentation.layout === 'split';
  const logoMark = (
    <span
      aria-label={logoImageUrl ? logoMedia?.alt_text : undefined}
      className={`grid size-10 place-items-center text-sm font-black ${
        logoImageUrl ? 'bg-contain bg-center bg-no-repeat' : 'rounded-2xl'
      }`}
      style={{
        backgroundColor: logoImageUrl ? 'transparent' : 'var(--tenant-primary)',
        backgroundImage: logoImageUrl ? `url(${logoImageUrl})` : undefined,
        color: logoImageUrl ? 'transparent' : 'var(--action-primary-text)',
      }}
      aria-hidden={logoImageUrl ? undefined : 'true'}
      role={logoImageUrl ? 'img' : undefined}
    >
      {logoImageUrl ? null : site.business.name.slice(0, 2).toUpperCase()}
    </span>
  );
  const brand = (
    <a
      className={`flex items-center gap-3 font-black tracking-tight ${centeredHeader ? 'flex-col gap-1 text-center' : 'text-lg'}`}
      href="#top"
    >
      {logoMark}
      <span>
        <span className="block">{site.business.name}</span>
        {centeredHeader ? (
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Boarding · Daycare · Grooming
          </span>
        ) : null}
      </span>
    </a>
  );
  const standardNavigationItems = sectionLayout
    .filter((section) => section.visible)
    .map((section) => ({
      href: `#${section.id}`,
      id: section.id,
      label: websiteSectionCatalog[section.id].name,
    }));
  const customNavigationItems = customPages
    .filter((page) => page.showInNavigation)
    .slice(0, 4)
    .map((page) => ({
      href: `/site/${site.business.slug}/pages/${page.slug}`,
      id: page.id,
      label: page.title,
    }));
  const navigationItems = [...standardNavigationItems, ...customNavigationItems];
  const navigation = (
    <nav
      className="hidden items-center gap-7 text-sm font-bold md:flex"
      aria-label="Business website"
    >
      {navigationItems.map((item) => (
        <a href={item.href} key={item.id}>
          {item.label}
        </a>
      ))}
    </nav>
  );
  const mobileNavigation = (
    <details className="relative md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black shadow-sm">
        Menu
      </summary>
      <nav
        aria-label="Mobile business website"
        className="absolute right-0 top-14 z-40 grid min-w-64 gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold shadow-xl"
      >
        {navigationItems.map((item) => (
          <a className="rounded-xl px-4 py-3 hover:bg-slate-50" href={item.href} key={item.id}>
            {item.label}
          </a>
        ))}
        <a className="rounded-xl px-4 py-3 hover:bg-slate-50" href="/portal">
          Customer sign in
        </a>
        <a
          className="rounded-xl px-4 py-3"
          href={`/book?tenant=${site.business.slug}`}
          style={{
            backgroundColor: 'var(--tenant-primary)',
            color: 'var(--action-primary-text)',
          }}
        >
          Book now
        </a>
      </nav>
    </details>
  );
  return (
    <main
      className={`min-h-screen ${presentation.canvas} ${presentation.font}`}
      style={
        {
          '--tenant-primary': site.brand_tokens.primary,
          '--tenant-accent': site.brand_tokens.accent,
          '--action-primary': site.brand_tokens.primary,
          '--action-primary-text': primaryTextColor,
        } as CSSProperties
      }
    >
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur">
        {centeredHeader ? (
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
              <div className="hidden md:flex">{navigation}</div>
              {brand}
              <div className="flex justify-end gap-3">
                <div className="hidden gap-3 md:flex">
                  <ButtonLink href="/portal" variant="secondary">
                    Sign in
                  </ButtonLink>
                  <ButtonLink href={`/book?tenant=${site.business.slug}`}>Book now</ButtonLink>
                </div>
                {mobileNavigation}
              </div>
            </div>
          </div>
        ) : splitHeader ? (
          <div className="mx-auto grid min-h-24 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-8 px-6">
            {brand}
            <div className="justify-self-center">{navigation}</div>
            <div className="hidden md:block">
              <ButtonLink href={`/book?tenant=${site.business.slug}`}>Book now</ButtonLink>
            </div>
            {mobileNavigation}
          </div>
        ) : (
          <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-6">
            {brand}
            <div className="ml-auto">{navigation}</div>
            <div className="hidden md:block">
              <ButtonLink href={`/book?tenant=${site.business.slug}`}>Book now</ButtonLink>
            </div>
            {mobileNavigation}
          </div>
        )}
      </header>
      <section className="relative overflow-hidden" id="top">
        <div
          className={`mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:py-24 ${presentation.heroGrid}`}
        >
          <div className={presentation.heroText}>
            <p
              className="text-xs font-black uppercase tracking-[0.22em]"
              style={{ color: 'var(--tenant-primary)' }}
            >
              Thoughtful care. Happy pets.
            </p>
            <h1
              className={`mt-5 max-w-3xl text-5xl font-black leading-[1.02] sm:text-6xl ${presentation.heading} ${centeredHeader ? 'mx-auto' : ''}`}
            >
              {String(content.hero_title)}
            </h1>
            <p
              className={`mt-6 max-w-2xl text-lg leading-8 text-slate-600 ${centeredHeader ? 'mx-auto' : ''}`}
            >
              {String(content.hero_body)}
            </p>
            <div className={`mt-8 flex flex-wrap gap-3 ${centeredHeader ? 'justify-center' : ''}`}>
              <ButtonLink href={`/book?tenant=${site.business.slug}`}>
                Book your pet&apos;s visit
              </ButtonLink>
              <ButtonLink href="/portal" variant="secondary">
                Customer portal
              </ButtonLink>
            </div>
            <div
              className={`mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-slate-600 ${centeredHeader ? 'justify-center' : ''}`}
            >
              <span>✓ Secure online booking</span>
              <span>✓ Care updates</span>
              <span>✓ Trusted local team</span>
            </div>
          </div>
          <div
            className={`relative min-h-[28rem] overflow-hidden bg-[linear-gradient(145deg,color-mix(in_srgb,var(--tenant-accent)_18%,white),color-mix(in_srgb,var(--tenant-primary)_10%,white))] shadow-[0_28px_80px_rgba(30,55,42,.12)] ${presentation.image} ${presentation.heroImage}`}
            aria-label={heroImageUrl ? heroMedia?.alt_text : undefined}
            role={heroImageUrl ? 'img' : undefined}
            style={
              heroImageUrl
                ? {
                    backgroundImage: `url(${heroImageUrl})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                  }
                : undefined
            }
          >
            {heroImageUrl ? (
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            ) : null}
            <div className="absolute inset-x-8 bottom-8 rounded-3xl bg-white/90 p-5 shadow-xl backdrop-blur">
              <p
                className="text-xs font-black uppercase tracking-[0.16em]"
                style={{ color: 'var(--tenant-primary)' }}
              >
                A day in good hands
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ['8:00', 'Welcome'],
                  ['12:00', 'Play time'],
                  ['5:30', 'Dinner'],
                ].map(([time, label]) => (
                  <div key={time}>
                    <p className="font-black">{time}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="absolute left-12 top-14 grid size-40 place-items-center rounded-full border-[12px] border-white/60 bg-white/35 text-6xl"
              aria-hidden="true"
            >
              🐾
            </div>
            <div className="absolute right-10 top-20 rounded-2xl bg-white/75 px-4 py-3 text-sm font-bold shadow-lg">
              Tail-wagging care
            </div>
          </div>
        </div>
      </section>
      <div className="flex flex-col">
        <section
          className={`border-y border-black/5 bg-white ${presentation.section}`}
          id="services"
          style={sectionStyle('services')}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p
                className="text-xs font-black uppercase tracking-[0.18em]"
                style={{ color: 'var(--tenant-primary)' }}
              >
                Ways we care
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">Everything your pet needs</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Choose a service built around comfort, safety, and a simple experience for you.
              </p>
            </div>
            {servicesImageUrl ? (
              <div
                aria-label={servicesMedia?.alt_text}
                className="mt-10 min-h-64 rounded-[2rem] bg-cover bg-center shadow-lg"
                role="img"
                style={{ backgroundImage: `url(${servicesImageUrl})` }}
              />
            ) : null}
            <div className={`mt-10 grid gap-5 ${presentation.serviceGrid}`}>
              {site.services.map((service, index) => (
                <article
                  className={`group p-6 transition hover:-translate-y-1 hover:shadow-xl ${presentation.card}`}
                  key={service.name}
                >
                  <span
                    className="grid size-11 place-items-center rounded-2xl bg-white font-black shadow-sm"
                    style={{ color: 'var(--tenant-primary)' }}
                  >
                    0{index + 1}
                  </span>
                  <p className="mt-6 text-xs font-black uppercase tracking-wide text-slate-500">
                    {service.category}
                  </p>
                  <h3 className="mt-1 text-xl font-black">{service.name}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
                  <a
                    className="mt-6 inline-block text-sm font-black"
                    style={{ color: 'var(--tenant-primary)' }}
                    href={`/book?tenant=${site.business.slug}`}
                  >
                    Explore this service →
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          className={`px-6 ${presentation.section}`}
          id="about"
          style={sectionStyle('about')}
        >
          {aboutImageUrl ? (
            <div
              aria-label={aboutMedia?.alt_text}
              className={`mx-auto mb-5 min-h-72 max-w-7xl bg-cover bg-center shadow-lg ${presentation.image}`}
              role="img"
              style={{ backgroundImage: `url(${aboutImageUrl})` }}
            />
          ) : null}
          <div className={`mx-auto max-w-7xl p-8 sm:p-10 ${presentation.about}`}>
            <p
              className={`text-xs font-black uppercase tracking-[0.18em] ${presentation.aboutEyebrow}`}
            >
              Why families choose us
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Care that feels personal</h2>
            <p className={`mt-5 text-lg leading-8 ${presentation.aboutMuted}`}>
              {String(content.about)}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                'Individual care notes',
                'Secure pet profiles',
                'Easy communication',
                'Consistent routines',
              ].map((item) => (
                <div
                  className={`rounded-xl border p-3 text-sm font-bold ${presentation.aboutItem}`}
                  key={item}
                >
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-white px-6 py-20" id="faq" style={sectionStyle('faq')}>
          <div className="mx-auto max-w-3xl">
            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--tenant-primary)' }}
            >
              Good to know
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Frequently asked questions</h2>
            <div className="mt-7 divide-y divide-black/10 border-y border-black/10">
              {faqs.map((faq) => (
                <details className="group py-5" key={faq.question}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black">
                    {faq.question}
                    <span className="text-xl font-normal transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-xl leading-7 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="px-6 py-20" id="highlights" style={sectionStyle('highlights')}>
          <div className="mx-auto max-w-7xl">
            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--tenant-primary)' }}
            >
              Care made easier
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Confidence at every step</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [
                  'Simple online booking',
                  'Choose services, share care details, and request a visit from any device.',
                ],
                [
                  'Personalized routines',
                  'Your pet profile keeps feeding, medication, and comfort notes together.',
                ],
                [
                  'Updates while away',
                  'Stay connected to the care experience from arrival through pickup.',
                ],
              ].map(([title, body]) => (
                <article className={`p-6 ${presentation.card}`} key={title}>
                  <h3 className="text-xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          className="border-y border-black/5 bg-white px-6 py-20"
          id="process"
          style={sectionStyle('process')}
        >
          <div className="mx-auto max-w-7xl">
            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--tenant-primary)' }}
            >
              How it works
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">From profile to pickup</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                ['1', 'Create a pet profile', 'Share the details the care team needs to prepare.'],
                [
                  '2',
                  'Book the right care',
                  'Choose dates, services, and add-ons in one guided flow.',
                ],
                [
                  '3',
                  'Stay connected',
                  'Manage the visit and receive updates from your customer portal.',
                ],
              ].map(([step, title, body]) => (
                <li className="flex gap-4" key={step}>
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full font-black"
                    style={{
                      backgroundColor: 'var(--tenant-primary)',
                      color: 'var(--action-primary-text)',
                    }}
                  >
                    {step}
                  </span>
                  <span>
                    <strong className="block text-lg">{title}</strong>
                    <span className="mt-2 block leading-7 text-slate-600">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="px-6 py-16" id="cta" style={sectionStyle('cta')}>
          <div
            className={`mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10 ${presentation.about}`}
          >
            <div>
              <p
                className={`text-xs font-black uppercase tracking-[0.18em] ${presentation.aboutEyebrow}`}
              >
                Ready when you are
              </p>
              <h2 className="mt-3 text-3xl font-black">Plan your pet&apos;s next visit</h2>
            </div>
            <ButtonLink href={`/book?tenant=${site.business.slug}`}>Book now</ButtonLink>
          </div>
        </section>
        <section
          className="bg-[#102d23] py-20 text-white"
          id="contact"
          style={sectionStyle('contact')}
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                We&apos;re here to help
              </p>
              <h2 className="mt-3 text-4xl font-black">Let&apos;s talk about your pet</h2>
              <p className="mt-5 leading-7 text-emerald-50/70">
                {String(content.contact_email)} · {String(content.contact_phone)}
              </p>
              <div className="mt-7 space-y-3">
                {site.locations.map((location) => (
                  <div className="rounded-xl border border-white/15 p-4" key={location.name}>
                    <p className="font-black">{location.name}</p>
                    <p className="mt-1 text-sm text-emerald-50/60">
                      Local time: {location.time_zone}
                    </p>
                  </div>
                ))}
              </div>
              <h3 className="mt-8 font-black">Policies</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-50/60">
                {String(content.policies)}
              </p>
            </div>
            <form
              action={submitInquiry}
              className="grid gap-4 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl sm:grid-cols-2 sm:p-8"
            >
              <div className="sm:col-span-2">
                <h2 className="text-2xl font-black">Send an inquiry</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The care team will respond using the details below.
                </p>
              </div>
              {typeof query.notice === 'string' ? (
                <p className="font-bold text-green-700 sm:col-span-2">{query.notice}</p>
              ) : null}
              {typeof query.error === 'string' ? (
                <p className="font-bold text-red-700 sm:col-span-2">{query.error}</p>
              ) : null}
              <input name="slug" type="hidden" value={site.business.slug} />
              <input className="hidden" name="website" tabIndex={-1} />
              <Field label="Name" name="name" required />
              <Field label="Email" name="email" required type="email" />
              <Field label="Phone" name="phone" />
              <label className="text-sm font-bold sm:col-span-2">
                How can we help?
                <textarea
                  className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3"
                  name="message"
                  required
                />
              </label>
              <label className="flex gap-3 text-sm sm:col-span-2">
                <input name="consent" required type="checkbox" value="yes" />I agree that this
                business may respond to my inquiry.
              </label>
              <div className="sm:col-span-2">
                <Button type="submit">Send message</Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
