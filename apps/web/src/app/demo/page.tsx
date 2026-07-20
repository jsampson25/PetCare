import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';

export const metadata: Metadata = {
  title: 'See Roventra',
  description: 'Choose a self-guided free trial or request a tailored Roventra walkthrough.',
};
export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(147,197,253,.6),transparent_35rem)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center lg:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#2563eb]">
            See it your way
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-7xl">
            Explore freely or bring us your hardest workflow.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#40516a]">
            Start building immediately, or choose a guided conversation focused on your services,
            capacity, pricing, team, and migration needs.
          </p>
          <div className="mt-14 grid gap-5 text-left md:grid-cols-2">
            <article className="rounded-[30px] border border-[#b8d0ee] bg-white p-8 shadow-[0_24px_70px_rgba(30,64,175,.1)]">
              <span className="rounded-full bg-[#e8f1ff] px-3 py-1.5 text-xs font-bold text-[#1d4ed8]">
                Self-guided
              </span>
              <h2 className="mt-6 text-3xl font-semibold">Start a 14-day trial</h2>
              <p className="mt-4 leading-7 text-[#40516a]">
                Create your business, choose a layout, configure services, and explore the connected
                workspace. No credit card required.
              </p>
              <Link
                className="mt-8 inline-block rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white"
                href="/auth/register?plan=growth&trial=14"
              >
                Start free trial
              </Link>
            </article>
            <article className="rounded-[30px] bg-[#0b1f3a] p-8 text-white shadow-[0_24px_70px_rgba(11,31,58,.18)]">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[#7dd3fc]">
                Guided
              </span>
              <h2 className="mt-6 text-3xl font-semibold">Request a tailored walkthrough</h2>
              <p className="mt-4 leading-7 text-white/75">
                Best for multi-location teams, complex migrations, or businesses that want to
                evaluate specific workflows before starting.
              </p>
              <a
                className="mt-8 inline-block rounded-xl bg-[#60a5fa] px-6 py-3.5 text-sm font-bold text-[#07182d]"
                href="mailto:hello@getroventra.com?subject=Roventra%20walkthrough"
              >
                Email our team
              </a>
            </article>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
