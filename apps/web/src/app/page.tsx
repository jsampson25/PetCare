import Link from 'next/link';

import { MarketingFooter } from '../components/marketing-footer';
import { MarketingHeader } from '../components/marketing-header';

const features = [
  {
    eyebrow: 'Sell beautifully',
    title: 'A website that actually feels like your business',
    description:
      'Choose a polished layout, apply your colors and logo, build custom pages, and keep booking inside the same branded experience.',
    accent: 'bg-[#e8f1ff] text-[#1d4ed8]',
    number: '01',
  },
  {
    eyebrow: 'Operate calmly',
    title: 'One workspace for the entire care team',
    description:
      'Reservations, pet profiles, arrivals, departures, feeding, medication, tasks, incidents, and customer updates stay connected.',
    accent: 'bg-[#e8f8ff] text-[#0369a1]',
    number: '02',
  },
  {
    eyebrow: 'Grow clearly',
    title: 'Know what is happening without chasing reports',
    description:
      'See occupancy, revenue, capacity, customer activity, and operational exceptions from a modern command center.',
    accent: 'bg-[#f0edff] text-[#6d4ed8]',
    number: '03',
  },
];

const workflow = [
  ['Pick a plan', 'Choose the foundation that fits your business today.'],
  ['Build your brand', 'Select a layout, upload your logo, and shape every page.'],
  ['Open for business', 'Publish your site, accept reservations, and run care from one place.'],
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
      <path
        d="M4 10h12m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-6xl">
      <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-[#7dd3fc]/25 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#a5b4fc]/25 blur-3xl" />
      <div className="relative rounded-[32px] border border-white/90 bg-white/75 p-3 shadow-[0_40px_120px_rgba(30,64,175,0.16)] backdrop-blur sm:p-5">
        <div className="flex items-center justify-between px-2 pb-4 sm:px-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#52627a]">
            One brand · Two connected experiences
          </p>
          <span className="h-7 w-7 rounded-full bg-[#dbeafe]" />
        </div>
        <div className="grid overflow-hidden rounded-[24px] border border-[#dbe7f5] lg:grid-cols-[0.82fr_1.18fr]">
          <div className="relative min-h-[410px] overflow-hidden bg-[#eaf3ff] p-6 sm:p-8">
            <div className="absolute right-[-70px] top-[-60px] h-52 w-52 rounded-full bg-[#93c5fd]/55" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#2563eb] text-xs font-black text-white">
                  H
                </span>
                <span className="text-xs font-bold">Happy Paws</span>
              </div>
              <span className="text-[9px] font-bold text-[#40516a]">
                Services&nbsp;&nbsp; About&nbsp;&nbsp; Contact
              </span>
            </div>
            <div className="relative mt-12 max-w-sm">
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-[9px] font-bold text-[#1d4ed8]">
                Nashville’s neighborhood pet retreat
              </span>
              <h3 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.05em]">
                Care they love. Confidence you feel.
              </h3>
              <p className="mt-4 text-sm leading-6 text-[#40516a]">
                Boarding, daycare, and grooming in a safe, joyful place that feels like home.
              </p>
              <button
                className="mt-6 rounded-xl bg-[#2563eb] px-4 py-2.5 text-[10px] font-bold text-white"
                type="button"
              >
                Book their stay
              </button>
            </div>
            <div className="absolute bottom-5 right-5 rounded-2xl border border-white bg-white/90 p-3 shadow-lg">
              <p className="text-[9px] font-bold">4.9 ★</p>
              <p className="mt-1 text-[8px] text-[#52627a]">Loved by 240+ pet parents</p>
            </div>
          </div>
          <div className="bg-[#f7faff] p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#52627a]">
                  Live operations
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-[-.03em]">Today at Happy Paws</h3>
              </div>
              <button
                className="rounded-xl bg-[#0b1f3a] px-3 py-2 text-[9px] font-bold text-white"
                type="button"
              >
                New reservation
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['34', 'In care'],
                ['8', 'Arriving'],
                ['6', 'Departing'],
                ['12', 'Tasks'],
              ].map(([value, label]) => (
                <div className="rounded-xl border border-[#dbe7f5] bg-white p-3" key={label}>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="mt-1 text-[9px] font-medium text-[#52627a]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_.9fr]">
              <div className="rounded-2xl border border-[#dbe7f5] bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Care pulse</p>
                  <span className="text-[9px] text-[#52627a]">92% complete</span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ['Breakfast', 'Complete', 'bg-[#22c55e]'],
                    ['Morning meds', '2 due', 'bg-[#f59e0b]'],
                    ['Playgroups', 'On schedule', 'bg-[#2563eb]'],
                  ].map(([label, status, color]) => (
                    <div className="flex items-center justify-between text-[10px]" key={label}>
                      <span className="flex items-center gap-2 font-semibold">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        {label}
                      </span>
                      <span className="text-[#52627a]">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[#0b1f3a] p-4 text-white">
                <p className="text-[10px] font-semibold text-white/75">Next arrival</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#60a5fa] text-xs font-black text-[#07182d]">
                    C
                  </span>
                  <div>
                    <p className="text-xs font-bold">Cooper</p>
                    <p className="mt-1 text-[9px] text-white/70">10:30 AM · Suite 12</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl bg-white/10 px-3 py-2 text-[9px] text-white/80">
                  Vaccines verified · Deposit paid
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute left-1/2 top-[49%] hidden -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#f7faff] bg-[#2563eb] px-4 py-2 text-[9px] font-black uppercase tracking-[.13em] text-white shadow-xl lg:block">
        Always connected
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />

      <section className="relative border-b border-[#dbe7f5]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(191,219,254,0.72),transparent_30rem),radial-gradient(circle_at_5%_70%,rgba(224,242,254,0.8),transparent_25rem)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c8dcf5] bg-white/85 px-3 py-1.5 text-xs font-bold text-[#1e4f91] shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
              Website, booking, and care operations in one platform
            </div>
            <h1 className="mx-auto mt-8 max-w-5xl text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl lg:text-[5.75rem]">
              Make every part of pet care
              <span className="block bg-gradient-to-r from-[#2563eb] via-[#0ea5e9] to-[#2563eb] bg-clip-text text-transparent">
                feel connected.
              </span>
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-[#40516a] sm:text-xl">
              Give customers a beautiful, customizable website—and give your team one calm workspace
              for reservations, pet records, payments, and daily care.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-6 text-sm font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
                href="/pricing"
              >
                Explore plans <ArrowIcon />
              </Link>
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#c8d9ee] bg-white/85 px-6 text-sm font-bold text-[#18324f] transition hover:border-[#93b6df] hover:bg-white"
                href="#platform"
              >
                See how it works
              </a>
            </div>
            <div className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs font-semibold text-[#40516a]">
              <span>One connected brand</span>
              <span aria-hidden="true" className="text-[#93b6df]">
                •
              </span>
              <span>Guided setup</span>
              <span aria-hidden="true" className="text-[#93b6df]">
                •
              </span>
              <span>Cancel anytime</span>
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-b border-[#dbe7f5] bg-white" id="platform">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2563eb]">
              One cohesive platform
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">
              Stop stitching together tools your customers can feel.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#40516a]">
              Every touchpoint—from your homepage to a pet’s report card—uses the same brand,
              information, and thoughtful experience.
            </p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                className="group rounded-[26px] border border-[#dbe7f5] bg-[#f8fbff] p-7 transition duration-300 hover:-translate-y-1 hover:border-[#b8d0ee] hover:bg-white hover:shadow-[0_22px_60px_rgba(30,64,175,0.11)]"
                key={feature.number}
              >
                <div
                  className={`grid h-11 w-11 place-items-center rounded-xl text-xs font-black ${feature.accent}`}
                >
                  {feature.number}
                </div>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#52627a]">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold leading-8 tracking-[-0.03em]">
                  {feature.title}
                </h3>
                <p className="mt-4 leading-7 text-[#40516a]">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1f3a] text-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-32">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
              From signup to opening day
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
              Launch without assembling a software department.
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/80">
              Roventra guides you from plan selection through setup, website design, services,
              policies, and publishing.
            </p>
          </div>
          <div className="divide-y divide-white/12 border-y border-white/12">
            {workflow.map(([title, description], index) => (
              <div
                className="grid grid-cols-[44px_1fr] gap-5 py-7 sm:grid-cols-[60px_0.65fr_1fr] sm:items-center"
                key={title}
              >
                <span className="text-sm font-bold text-[#7dd3fc]">0{index + 1}</span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="col-start-2 text-sm leading-6 text-white/75 sm:col-start-auto">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#eaf3ff]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-20 lg:flex-row lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1d4ed8]">
              Ready when you are
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Build a better customer experience and a calmer business.
            </h2>
          </div>
          <Link
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-6 text-sm font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
            href="/pricing"
          >
            View pricing <ArrowIcon />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
