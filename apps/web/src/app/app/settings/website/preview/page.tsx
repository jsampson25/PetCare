import { ButtonLink } from '@petcare/ui/button-link';
import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { resolveBusinessContext } from '../../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const metadata = { robots: { index: false, follow: false } };

type DraftPreview = {
  business: { name: string; slug: string };
  theme_key: 'modern' | 'warm' | 'classic';
  brand_tokens: { primary: string; accent: string };
  content: Record<string, unknown>;
  services: Array<{ name: string; description: string | null; category: string }>;
};

export default async function PreviewPage() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_tenant_website_draft_preview', {
    target_business_id: context.businessId,
  });
  if (!data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black">Your website draft is empty</h1>
        <p className="mt-3 text-slate-600">Save the website editor before opening preview.</p>
        <div className="mt-6">
          <ButtonLink href="/app/settings/website">Return to editor</ButtonLink>
        </div>
      </div>
    );
  }

  const site = data as DraftPreview;
  const content = site.content;
  const centered = site.theme_key === 'modern';
  const visibleSections = new Set(
    Array.isArray(content.section_layout)
      ? (content.section_layout as Array<{ id: string; visible: boolean }>)
          .filter((section) => section.visible)
          .map((section) => section.id)
      : ['services', 'about', 'faq', 'contact'],
  );
  const customPages = Array.isArray(content.custom_pages)
    ? (content.custom_pages as Array<{
        id: string;
        title: string;
        showInNavigation: boolean;
      }>)
    : [];

  return (
    <main
      className="min-h-screen bg-[#fcfcfd] text-[#17171b]"
      style={
        {
          '--tenant-primary': site.brand_tokens.primary,
          '--tenant-accent': site.brand_tokens.accent,
          '--action-primary': site.brand_tokens.primary,
        } as CSSProperties
      }
    >
      <div className="sticky top-0 z-50 flex min-h-12 items-center justify-center gap-4 border-b border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-950">
        <span>Private draft preview</span>
        <span className="hidden font-normal text-amber-800 sm:inline">
          Only you and authorized staff can see this version.
        </span>
        <a className="underline" href="/app/settings/website">
          Back to editor
        </a>
      </div>

      <header className="border-b border-slate-200/80 bg-white">
        <div
          className={`mx-auto max-w-7xl px-6 py-5 ${
            centered
              ? 'grid grid-cols-[1fr_auto_1fr] items-center'
              : 'flex items-center justify-between gap-8'
          }`}
        >
          {centered ? (
            <nav className="hidden gap-6 text-sm font-semibold lg:flex">
              <a href="#services">Services</a>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </nav>
          ) : null}
          <a
            className={`flex items-center gap-3 ${centered ? 'flex-col gap-1 text-center' : ''}`}
            href="#top"
          >
            <span
              className="grid size-11 place-items-center rounded-2xl text-xs font-black text-white shadow-sm"
              style={{ background: 'var(--tenant-primary)' }}
            >
              HP
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight">{site.business.name}</span>
              <span className="block text-[0.6rem] font-bold uppercase tracking-[0.18em] text-slate-500">
                Boarding · Daycare · Grooming
              </span>
            </span>
          </a>
          <div className={`flex items-center gap-3 ${centered ? 'justify-self-end' : ''}`}>
            {!centered ? (
              <nav className="mr-4 hidden gap-6 text-sm font-semibold lg:flex">
                <a href="#services">Services</a>
                <a href="#about">About</a>
                {customPages
                  .filter((page) => page.showInNavigation)
                  .slice(0, 1)
                  .map((page) => (
                    <span key={page.id}>{page.title}</span>
                  ))}
              </nav>
            ) : null}
            <span className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">
              Sign in
            </span>
            <span
              className="rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm"
              style={{ background: 'var(--tenant-primary)' }}
            >
              Book now
            </span>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden" id="top">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,color-mix(in_srgb,var(--tenant-accent)_16%,transparent),transparent_28rem)]" />
        <div
          className={`relative mx-auto max-w-7xl px-6 py-20 sm:py-28 ${
            centered ? 'text-center' : 'grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center'
          }`}
        >
          <div className={centered ? 'mx-auto max-w-4xl' : ''}>
            <p
              className="text-xs font-black uppercase tracking-[0.24em]"
              style={{ color: 'var(--tenant-primary)' }}
            >
              A happier stay starts here
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-7xl">
              {String(content.hero_title ?? 'Exceptional care for every pet')}
            </h1>
            <p
              className={`mt-7 max-w-2xl text-lg leading-8 text-slate-600 ${centered ? 'mx-auto' : ''}`}
            >
              {String(content.hero_body ?? '')}
            </p>
            <div className={`mt-9 flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>
              <span
                className="rounded-xl px-6 py-3.5 font-black text-white shadow-lg"
                style={{ background: 'var(--tenant-primary)' }}
              >
                Book your pet&apos;s stay
              </span>
              <span className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-black shadow-sm">
                Explore our services
              </span>
            </div>
            <div
              className={`mt-10 flex flex-wrap gap-5 text-sm font-semibold text-slate-500 ${centered ? 'justify-center' : ''}`}
            >
              <span>✓ Simple online booking</span>
              <span>✓ Personalized care</span>
              <span>✓ Updates while you&apos;re away</span>
            </div>
          </div>
          <div
            className={`relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_30px_90px_rgba(25,25,35,.12)] ${centered ? 'mx-auto mt-16 max-w-5xl' : ''}`}
          >
            <div
              className="absolute inset-0 opacity-90"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--tenant-primary) 12%, white), color-mix(in srgb, var(--tenant-accent) 22%, white))',
              }}
            />
            <div className="absolute left-1/2 top-1/2 grid size-40 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-7xl shadow-xl backdrop-blur">
              🐾
            </div>
            <div className="absolute inset-x-6 bottom-6 grid grid-cols-3 gap-3 rounded-2xl bg-white/90 p-4 text-left shadow-xl backdrop-blur sm:inset-x-auto sm:right-6 sm:w-[24rem]">
              {[
                ['8:00', 'Welcome'],
                ['12:00', 'Playtime'],
                ['5:30', 'Dinner'],
              ].map(([time, label]) => (
                <div key={time}>
                  <p className="font-black">{time}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {visibleSections.has('services') ? (
        <section className="border-y border-slate-200/70 bg-white py-20" id="services">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p
                  className="text-xs font-black uppercase tracking-[0.22em]"
                  style={{ color: 'var(--tenant-primary)' }}
                >
                  Services made for them
                </p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">
                  Care for every kind of day
                </h2>
              </div>
              <p className="max-w-md leading-7 text-slate-600">
                Safe routines, thoughtful attention, and an easy experience from booking through
                pickup.
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {(site.services.length
                ? site.services
                : [
                    {
                      name: 'Overnight boarding',
                      description: 'Comfortable stays with personalized routines.',
                      category: 'Boarding',
                    },
                    {
                      name: 'Dog daycare',
                      description: 'Supervised play, enrichment, and rest.',
                      category: 'Daycare',
                    },
                    {
                      name: 'Bath and grooming',
                      description: 'Fresh, comfortable, and ready for home.',
                      category: 'Grooming',
                    },
                  ]
              ).map((service, index) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-[#fcfcfd] p-6 transition hover:-translate-y-1 hover:shadow-xl"
                  key={service.name}
                >
                  <span
                    className="grid size-11 place-items-center rounded-xl text-sm font-black text-white"
                    style={{ background: 'var(--tenant-primary)' }}
                  >
                    0{index + 1}
                  </span>
                  <p className="mt-7 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                    {service.category}
                  </p>
                  <h3 className="mt-2 text-xl font-black">{service.name}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {visibleSections.has('about') ? (
        <section className="px-6 py-20" id="about">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 text-white lg:grid-cols-[0.9fr_1.1fr]">
            <div
              className="min-h-72"
              style={{
                background:
                  'linear-gradient(145deg, color-mix(in srgb, var(--tenant-primary) 75%, #101827), color-mix(in srgb, var(--tenant-accent) 35%, #101827))',
              }}
            />
            <div className="p-8 sm:p-12">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Why families choose us
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight">Care that feels personal</h2>
              <p className="mt-6 text-lg leading-8 text-white/70">{String(content.about ?? '')}</p>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6">
          <p className="font-black">{site.business.name}</p>
          <p className="text-sm text-slate-500">
            {String(content.contact_email ?? '')} · {String(content.contact_phone ?? '')}
          </p>
        </div>
      </footer>
    </main>
  );
}
