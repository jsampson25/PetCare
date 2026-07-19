import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';
import { solutions } from '../../lib/marketing/solutions';

export const metadata: Metadata = {
  title: 'Solutions',
  description:
    'Connected software for boarding, daycare, grooming, training, multi-location operations, and branded pet-care websites.',
};

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="border-b border-[#dbe7f5] bg-[radial-gradient(circle_at_75%_10%,#dbeafe,transparent_30rem)]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2563eb]">
            Built around the work
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
            Every service gets the workflow it needs.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#40516a]">
            Roventra connects specialized service operations around one customer, one pet record,
            one brand, and one view of the business.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-2 lg:px-8 lg:py-24">
        {solutions.map((solution, index) => (
          <Link
            className="group rounded-[28px] border border-[#dbe7f5] bg-white p-8 transition hover:-translate-y-1 hover:border-[#9bbce5] hover:shadow-[0_22px_60px_rgba(30,64,175,0.1)]"
            href={`/solutions/${solution.slug}`}
            key={solution.slug}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#2563eb]">
                {solution.eyebrow}
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e8f1ff] text-sm font-bold text-[#1d4ed8]">
                0{index + 1}
              </span>
            </div>
            <h2 className="mt-8 max-w-xl text-3xl font-semibold tracking-[-0.04em]">
              {solution.title}
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-[#40516a]">{solution.summary}</p>
            <span className="mt-8 inline-flex font-bold text-[#1d4ed8]">Explore solution →</span>
          </Link>
        ))}
      </section>
      <MarketingFooter />
    </main>
  );
}
