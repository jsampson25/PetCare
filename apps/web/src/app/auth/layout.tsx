import type { ReactNode } from 'react';
import Link from 'next/link';

import { RoventraLogo } from '../../components/roventra-logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const benefits = [
    'Customize your website and booking flow',
    'Keep every pet and customer record together',
    'Guide staff through safe, accountable care',
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7faff] text-[#0b1f3a] [--action-primary:#2563eb] [--action-primary-active:#1e40af] [--action-primary-hover:#1d4ed8] [--border-default:#dbe7f5] [--border-strong:#b8cce5] [--focus-ring:#2563eb] [--link-default:#1d4ed8] [--surface-canvas:#f7faff] [--surface-subtle:#eef5ff] [--text-primary:#0b1f3a] [--text-secondary:#52627a]">
      <div
        aria-hidden="true"
        className="absolute -left-28 -top-28 size-96 rounded-full bg-[#bfdbfe]/45 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-20 size-[28rem] rounded-full bg-[#bae6fd]/40 blur-3xl"
      />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden px-8 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <Brand />
          <div className="max-w-lg pb-12">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#2563eb]">
              Your business, connected
            </p>
            <h2 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-.055em]">
              A beautiful first impression. A calmer day behind it.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[#52627a]">
              Build your branded website, welcome customers, and run every day of care from one
              consistent platform.
            </p>
            <div className="mt-9 grid gap-3 text-sm font-semibold text-[#40516a]">
              {benefits.map((item) => (
                <div className="flex items-center gap-3" key={item}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#dbeafe] text-xs font-black text-[#1d4ed8]">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs font-semibold text-[#6b7b91]">
            14 days free · No credit card required
          </p>
        </aside>
        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:border-l lg:border-[#dbe7f5] lg:bg-white/55 lg:py-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Brand />
            </div>
            {children}
            <p className="mt-6 text-center text-xs leading-5 text-[#6b7b91]">
              Review our{' '}
              <Link
                className="font-semibold text-[#1d4ed8] underline"
                href="/terms"
                rel="noreferrer"
                target="_blank"
              >
                Terms
              </Link>
              ,{' '}
              <Link
                className="font-semibold text-[#1d4ed8] underline"
                href="/privacy"
                rel="noreferrer"
                target="_blank"
              >
                Privacy Policy
              </Link>
              , and{' '}
              <Link
                className="font-semibold text-[#1d4ed8] underline"
                href="/cookies"
                rel="noreferrer"
                target="_blank"
              >
                Cookie Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <Link className="inline-flex" href="/" aria-label="Roventra home">
      <RoventraLogo className="h-11 w-auto" priority />
    </Link>
  );
}
