import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Flexible Roventra plans for boarding, daycare, grooming, and multi-location pet-care businesses.',
};

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    description:
      'For an independent pet-care business ready to look polished and move booking online.',
    price: '$79',
    suffix: '/ month',
    features: [
      'Branded business website',
      'Online reservations',
      'Customer and pet profiles',
      'Vaccination records',
      'Core calendar and operations',
      'Email confirmations',
    ],
    featured: false,
  },
  {
    key: 'growth',
    name: 'Growth',
    description:
      'For established teams that need deeper operations, automation, and customer engagement.',
    price: '$149',
    suffix: '/ month',
    features: [
      'Everything in Starter',
      'Advanced website layouts',
      'Payments and deposits',
      'Staff care workflows',
      'Automated customer messaging',
      'Reports and performance insights',
    ],
    featured: true,
  },
  {
    key: 'scale',
    name: 'Scale',
    description:
      'For multi-location operators that need centralized controls, reporting, and support.',
    price: 'Custom',
    suffix: '',
    features: [
      'Everything in Growth',
      'Multiple locations',
      'Centralized brand controls',
      'Advanced permissions',
      'Portfolio reporting',
      'Guided migration and onboarding',
    ],
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="relative overflow-hidden border-b border-[#dbe7f5]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(191,219,254,0.82),transparent_36rem)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 text-center lg:px-8 lg:pb-20 lg:pt-28">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2563eb]">
            Simple, transparent plans
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-7xl">
            Start with what you need. Grow without rebuilding.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#40516a]">
            Every plan brings your public website, customer booking experience, and business
            workspace together.
          </p>
          <div className="mx-auto mt-8 inline-flex rounded-full border border-[#c8d9ee] bg-white p-1 text-xs font-bold shadow-sm">
            <span className="rounded-full bg-[#2563eb] px-4 py-2 text-white">Monthly</span>
            <span className="px-4 py-2 text-[#40516a]">Annual · save 15%</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              className={`relative flex flex-col rounded-[28px] border p-7 sm:p-8 ${plan.featured ? 'border-[#2563eb] bg-[#0b1f3a] text-white shadow-[0_28px_80px_rgba(30,64,175,0.2)]' : 'border-[#dbe7f5] bg-white'}`}
              key={plan.key}
            >
              {plan.featured ? (
                <span className="absolute right-6 top-6 rounded-full bg-[#7dd3fc] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#0b1f3a]">
                  Most popular
                </span>
              ) : null}
              <p
                className={`text-sm font-bold ${plan.featured ? 'text-[#7dd3fc]' : 'text-[#2563eb]'}`}
              >
                {plan.name}
              </p>
              <p
                className={`mt-4 min-h-20 leading-7 ${plan.featured ? 'text-white/80' : 'text-[#40516a]'}`}
              >
                {plan.description}
              </p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-semibold tracking-[-0.055em]">{plan.price}</span>
                <span
                  className={`pb-1 text-sm ${plan.featured ? 'text-white/75' : 'text-[#52627a]'}`}
                >
                  {plan.suffix}
                </span>
              </div>
              <Link
                className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-xl text-sm font-bold transition ${plan.featured ? 'bg-[#60a5fa] text-[#07182d] hover:bg-[#93c5fd]' : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'}`}
                href={`/auth/register?plan=${plan.key}`}
              >
                {plan.key === 'scale' ? 'Talk to our team' : 'Choose plan'}
              </Link>
              <div className={`my-8 h-px ${plan.featured ? 'bg-white/20' : 'bg-[#e4ecf7]'}`} />
              <ul className="space-y-4 text-sm">
                {plan.features.map((feature) => (
                  <li className="flex gap-3" key={feature}>
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${plan.featured ? 'bg-[#60a5fa] text-[#07182d]' : 'bg-[#e8f1ff] text-[#1d4ed8]'}`}
                    >
                      ✓
                    </span>
                    <span className={plan.featured ? 'text-white/90' : 'text-[#40516a]'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-xs leading-5 text-[#52627a]">
          Preview pricing for the Roventra early-access release. Plan billing and final entitlements
          are confirmed before checkout.
        </p>
      </section>

      <section className="border-y border-[#dbe7f5] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2563eb]">
              Included from day one
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">
              Your brand stays with the customer.
            </h2>
          </div>
          <p className="text-lg leading-8 text-[#40516a]">
            Your public pages, booking journey, account creation, pet profiles, confirmations, and
            customer portal share one cohesive visual system. Customers never feel sent to
            disconnected third-party software.
          </p>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
