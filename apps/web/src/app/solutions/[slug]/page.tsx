import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarketingFooter } from '../../../components/marketing-footer';
import { MarketingHeader } from '../../../components/marketing-header';
import { findSolution, solutions } from '../../../lib/marketing/solutions';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return solutions.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const solution = findSolution((await params).slug);
  return solution ? { title: solution.eyebrow, description: solution.summary } : {};
}

export default async function SolutionPage({ params }: Props) {
  const solution = findSolution((await params).slug);
  if (!solution) notFound();

  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="relative overflow-hidden border-b border-[#dbe7f5]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(147,197,253,.55),transparent_30rem)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2563eb]">
              {solution.eyebrow}
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
              {solution.title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#40516a]">{solution.summary}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                className="rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,.22)]"
                href="/pricing"
              >
                Explore plans
              </Link>
              <Link
                className="rounded-xl border border-[#b8cce5] bg-white px-6 py-3.5 text-sm font-bold"
                href="/features"
              >
                View all capabilities
              </Link>
            </div>
          </div>
          <div className="rounded-[30px] border border-white bg-white/85 p-7 shadow-[0_30px_90px_rgba(30,64,175,.14)] backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#52627a]">
              Designed outcomes
            </p>
            <div className="mt-6 space-y-3">
              {solution.outcomes.map((outcome, index) => (
                <div
                  className="flex items-center gap-4 rounded-2xl border border-[#dbe7f5] bg-[#f7faff] p-4"
                  key={outcome}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-xs font-black text-[#1d4ed8]">
                    0{index + 1}
                  </span>
                  <span className="font-semibold">{outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#2563eb]">
          Connected capabilities
        </p>
        <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.045em] sm:text-5xl">
          Depth where the operation needs it.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {solution.capabilities.map((capability, index) => (
            <article
              className="rounded-[26px] border border-[#dbe7f5] bg-white p-7"
              key={capability.title}
            >
              <span className="text-xs font-black text-[#2563eb]">0{index + 1}</span>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-.03em]">{capability.title}</h3>
              <p className="mt-3 leading-7 text-[#40516a]">{capability.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-[#0b1f3a] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-16 lg:flex-row lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#7dd3fc]">
              One platform
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">
              Connect this workflow to the entire customer journey.
            </h2>
          </div>
          <Link
            className="rounded-xl bg-[#60a5fa] px-6 py-3.5 text-sm font-bold text-[#07182d]"
            href="/solutions"
          >
            Explore every solution
          </Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
