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
    <div className="relative mx-auto w-full max-w-[620px] lg:mr-0">
      <div className="absolute -left-14 top-20 hidden h-36 w-36 rounded-full bg-[#7dd3fc]/30 blur-3xl sm:block" />
      <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-[#93c5fd]/35 blur-3xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white bg-white p-3 shadow-[0_35px_100px_rgba(30,64,175,0.17)]">
        <div className="flex items-center justify-between border-b border-[#e4ecf7] px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff846e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f3bd57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#57bb8a]" />
          </div>
          <div className="rounded-full bg-[#eef5ff] px-4 py-1.5 text-[10px] font-semibold text-[#40516a]">
            Happy Paws · Live operations
          </div>
          <span className="h-7 w-7 rounded-full bg-[#dbeafe]" />
        </div>
        <div className="grid min-h-[390px] grid-cols-[70px_1fr] sm:grid-cols-[150px_1fr]">
          <aside className="border-r border-[#dbe7f5] bg-[#0b1f3a] p-3 text-white sm:p-4">
            <div className="mb-7 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#60a5fa] text-sm font-black text-[#07182d]">
                H
              </span>
              <span className="hidden text-xs font-bold sm:block">Happy Paws</span>
            </div>
            {['Overview', 'Calendar', 'Guests', 'Care board', 'Messages'].map((item, index) => (
              <div
                className={`mb-2 rounded-lg px-2 py-2 text-[10px] ${index === 0 ? 'bg-[#2563eb] font-bold text-white' : 'text-white/75'}`}
                key={item}
              >
                <span className="hidden sm:inline">{item}</span>
                <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-current sm:hidden" />
              </div>
            ))}
          </aside>
          <div className="bg-[#f6f9fe] p-4 sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#52627a]">
                  Sunday, July 19
                </p>
                <p className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0b1f3a] sm:text-2xl">
                  Good afternoon, Jason
                </p>
              </div>
              <button
                className="hidden rounded-xl bg-[#2563eb] px-3 py-2 text-[10px] font-bold text-white sm:block"
                type="button"
              >
                New reservation
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['34', 'In care'],
                ['8', 'Arrivals'],
                ['6', 'Departures'],
                ['12', 'Tasks due'],
              ].map(([value, label]) => (
                <div className="rounded-xl border border-[#dbe7f5] bg-white p-3" key={label}>
                  <p className="text-xl font-bold text-[#0b1f3a]">{value}</p>
                  <p className="mt-1 text-[9px] font-medium text-[#52627a]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-[#dbe7f5] bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Occupancy</p>
                  <p className="text-[9px] font-medium text-[#52627a]">This week</p>
                </div>
                <div className="mt-6 flex h-24 items-end gap-2">
                  {[42, 58, 51, 76, 88, 94, 72].map((height, index) => (
                    <div className="flex flex-1 flex-col items-center gap-2" key={height + index}>
                      <div
                        className="w-full rounded-t-md bg-[#60a5fa]"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[8px] text-[#8a948e]">{'SMTWTFS'[index]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[#0b1f3a] p-4 text-white">
                <p className="text-[10px] font-semibold text-white/80">Care completion</p>
                <p className="mt-3 text-3xl font-bold">92%</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[92%] rounded-full bg-[#60a5fa]" />
                </div>
                <p className="mt-4 text-[9px] leading-4 text-white/75">
                  48 of 52 scheduled care tasks completed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-4 hidden rounded-2xl border border-[#dbe7f5] bg-white p-4 shadow-[0_18px_50px_rgba(30,64,175,0.14)] sm:block">
        <p className="text-[10px] font-semibold text-[#52627a]">Website conversion</p>
        <p className="mt-1 text-xl font-bold text-[#1d4ed8]">+18.4%</p>
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
        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:pb-32 lg:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c8dcf5] bg-white/85 px-3 py-1.5 text-xs font-bold text-[#1e4f91] shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
              The modern platform for pet-care businesses
            </div>
            <h1 className="mt-7 max-w-3xl text-[3.35rem] font-semibold leading-[0.98] tracking-[-0.065em] sm:text-7xl lg:text-[5rem]">
              Your website and your operation,
              <span className="text-[#2563eb]"> finally together.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#40516a] sm:text-xl">
              Roventra gives boarding, daycare, and grooming businesses a beautiful website,
              effortless booking, and one connected workspace for every day of care.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#40516a]">
              <span>✓ One connected brand</span>
              <span>✓ Guided setup</span>
              <span>✓ Cancel anytime</span>
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
