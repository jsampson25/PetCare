import type { Metadata } from 'next';

import { MarketingCta } from '../../components/marketing-cta';
import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';

export const metadata: Metadata = {
  title: 'Switch to Roventra',
  description: 'A guided path for moving your pet-care website and operating data to Roventra.',
};
const steps = [
  [
    'Discover',
    'Map your services, locations, policies, capacity rules, website, and existing systems.',
  ],
  [
    'Prepare',
    'Clean and validate customer, pet, vaccine, reservation, package, and balance data before import.',
  ],
  [
    'Configure',
    'Build your branded website, booking rules, permissions, communications, and operational boards.',
  ],
  [
    'Rehearse',
    'Run test bookings, check-ins, payments, messages, reports, and staff workflows with your team.',
  ],
  [
    'Launch',
    'Publish the website, complete the controlled cutover, and monitor the first days of live operation.',
  ],
];
export default function SwitchPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="border-b border-[#dbe7f5]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1fr_.72fr] lg:items-end lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#2563eb]">
              Switch with confidence
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-7xl">
              Your next platform should not cost you your history.
            </h1>
          </div>
          <p className="text-lg leading-8 text-[#40516a]">
            Roventra’s migration path is designed to protect the records your team relies on while
            giving you time to configure, test, and train before launch.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="space-y-4">
          {steps.map(([title, description], index) => (
            <article
              className="grid gap-5 rounded-[24px] border border-[#dbe7f5] bg-white p-6 sm:grid-cols-[64px_180px_1fr] sm:items-center"
              key={title}
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f1ff] text-sm font-black text-[#2563eb]">
                0{index + 1}
              </span>
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="leading-7 text-[#40516a]">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [
              'Data validation',
              'Duplicates, missing values, ownership, and dates are reviewed before cutover.',
            ],
            [
              'Parallel testing',
              'Your team validates representative workflows without disrupting live work.',
            ],
            [
              'Launch support',
              'A documented cutover and rollback plan keeps responsibilities clear.',
            ],
          ].map(([title, description]) => (
            <div className="rounded-[22px] bg-[#0b1f3a] p-6 text-white" key={title}>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
            </div>
          ))}
        </div>
      </section>
      <MarketingCta
        eyebrow="Bring your business with you"
        title="A cleaner future without abandoning the data that got you here."
      />
      <MarketingFooter />
    </main>
  );
}
