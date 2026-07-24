import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { getWebsitePresentation, type WebsiteThemeKey } from '../../../lib/websites/presentation';

const themeForTemplate: Record<string, WebsiteThemeKey> = {
  'studio-split': 'modern',
  'centered-studio': 'modern',
  'modern-editorial': 'modern',
  'happy-tails': 'warm',
  'pet-parade': 'warm',
  neighborhood: 'warm',
  heritage: 'classic',
  lodge: 'classic',
  professional: 'classic',
};

const templateNames: Record<string, string> = {
  'studio-split': 'Studio Split',
  'centered-studio': 'Centered Studio',
  'modern-editorial': 'Modern Editorial',
  'happy-tails': 'Happy Tails',
  'pet-parade': 'Pet Parade',
  neighborhood: 'Neighborhood',
  heritage: 'Heritage',
  lodge: 'Lodge',
  professional: 'Professional',
};

const palettes = {
  modern: { accent: '#2864ed', primary: '#0b1f3a', soft: '#dbeafe' },
  warm: { accent: '#f97316', primary: '#0f766e', soft: '#ffedd5' },
  classic: { accent: '#9a6b45', primary: '#23483b', soft: '#eee5d5' },
} satisfies Record<WebsiteThemeKey, Record<string, string>>;

export default async function ThemeDemoPage({ params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  const theme = themeForTemplate[template];
  if (!theme) notFound();
  const presentation = getWebsitePresentation(theme, template);
  const palette = palettes[theme];
  const centered = presentation.centered;

  return (
    <main
      className={`min-h-screen ${presentation.canvas} ${presentation.font}`}
      style={
        {
          '--demo-accent': palette.accent,
          '--demo-primary': palette.primary,
          '--demo-soft': palette.soft,
        } as CSSProperties
      }
    >
      <div className="bg-[var(--demo-primary)] px-5 py-2 text-center text-xs font-bold text-white">
        Theme demo: {templateNames[template]}
      </div>
      <header className="border-b border-black/10 bg-white/90 backdrop-blur">
        <div
          className={`mx-auto max-w-7xl px-6 py-5 ${centered ? 'grid grid-cols-[1fr_auto_1fr] items-center' : 'flex items-center justify-between'}`}
        >
          {centered ? (
            <nav className="hidden gap-7 text-sm font-semibold lg:flex">
              <span>Services</span>
              <span>About</span>
            </nav>
          ) : null}
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 place-items-center rounded-2xl font-black text-white"
              style={{ background: 'var(--demo-primary)' }}
            >
              W
            </span>
            <span>
              <span className="block text-xl font-black">Willow &amp; Wag</span>
              <span className="block text-[0.6rem] font-bold uppercase tracking-[.18em] opacity-60">
                Boarding · Daycare · Grooming
              </span>
            </span>
          </div>
          <nav
            className={`items-center gap-7 text-sm font-semibold ${centered ? 'justify-self-end' : 'hidden lg:flex'}`}
          >
            {!centered ? (
              <>
                <span>Services</span>
                <span>About</span>
                <span>Contact</span>
              </>
            ) : null}
            <span
              className="rounded-xl px-5 py-3 font-black text-white"
              style={{ background: 'var(--demo-accent)' }}
            >
              Book now
            </span>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className={`relative mx-auto grid max-w-7xl gap-14 px-6 py-20 sm:py-28 ${presentation.heroGrid}`}
        >
          <div className={presentation.heroText}>
            <p
              className="text-xs font-black uppercase tracking-[.22em]"
              style={{ color: 'var(--demo-accent)' }}
            >
              Thoughtful care, every stay
            </p>
            <h1
              className={`mt-5 text-5xl font-black leading-[.98] sm:text-7xl ${presentation.heading}`}
            >
              Their favorite place when you’re away.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 opacity-70">
              Safe stays, joyful play, and personal updates from a team that knows every guest by
              name.
            </p>
            <div className={`mt-9 flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>
              <span
                className="rounded-xl px-6 py-3.5 font-black text-white shadow-lg"
                style={{ background: 'var(--demo-accent)' }}
              >
                Reserve a stay
              </span>
              <span className="rounded-xl border border-black/15 bg-white px-6 py-3.5 font-black">
                Explore our care
              </span>
            </div>
          </div>
          <div
            className={`${presentation.heroImage} relative min-h-[26rem] overflow-hidden ${presentation.image}`}
            style={{
              background:
                'linear-gradient(145deg, var(--demo-soft), white 60%, color-mix(in srgb, var(--demo-accent) 18%, white))',
            }}
          >
            <div className="absolute bottom-0 left-[14%] h-[72%] w-[72%] rounded-t-[50%] bg-white/65" />
            <div
              className="absolute bottom-[14%] left-[34%] size-40 rounded-full opacity-45"
              style={{ background: 'var(--demo-accent)' }}
            />
            <div className="absolute bottom-8 right-8 rounded-2xl bg-white p-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">
                Guest happiness
              </p>
              <p className="mt-1 text-3xl font-black">4.9 / 5</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`mx-auto max-w-7xl px-6 ${presentation.section}`}>
        <div className="max-w-2xl">
          <p
            className="text-xs font-black uppercase tracking-[.2em]"
            style={{ color: 'var(--demo-accent)' }}
          >
            Care made simple
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight">
            Everything they need in one happy place.
          </h2>
        </div>
        <div className={`mt-10 grid gap-5 ${presentation.serviceGrid}`}>
          {[
            ['Overnight boarding', 'Comfortable rooms, attentive care, and daily updates.'],
            ['Daycare', 'Supervised play groups designed around size and temperament.'],
            ['Grooming', 'Fresh coats, tidy paws, and easy add-ons before pickup.'],
          ].map(([name, description]) => (
            <article className={`${presentation.card} p-7`} key={name}>
              <span
                className="grid size-11 place-items-center rounded-xl text-lg font-black text-white"
                style={{ background: 'var(--demo-accent)' }}
              >
                +
              </span>
              <h3 className="mt-6 text-xl font-black">{name}</h3>
              <p className="mt-3 leading-7 opacity-65">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className={`${presentation.about} grid gap-10 p-8 sm:p-12 ${presentation.aboutGrid}`}>
          <div>
            <p
              className={`text-xs font-black uppercase tracking-[.2em] ${presentation.aboutEyebrow}`}
            >
              Meet Willow &amp; Wag
            </p>
            <h2 className="mt-4 text-4xl font-black">Local people who love pets.</h2>
          </div>
          <p className={`text-lg leading-8 ${presentation.aboutMuted}`}>
            Our team creates calm routines, safe play, and clear communication so families always
            know how their pets are doing.
          </p>
        </div>
      </section>
    </main>
  );
}
