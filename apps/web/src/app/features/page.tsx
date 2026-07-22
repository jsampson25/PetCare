import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore Roventra capabilities across websites, booking, care operations, customer experience, revenue, teams, analytics, and multi-location management.',
};

const capabilityGroups = [
  {
    title: 'Website, brand, and conversion',
    lead: 'A complete public presence that goes far beyond a disconnected booking widget.',
    items: [
      'Theme and layout selection',
      'Visual sections and custom pages',
      'Colors, typography, logo, and media',
      'Custom domains and search metadata',
      'Branded booking and account creation',
      'Customer portal theme continuity',
      'Service, pricing, policy, gallery, FAQ, and contact pages',
      'Preview, versioning, publishing, and rollback',
    ],
  },
  {
    title: 'Booking, pricing, and capacity',
    lead: 'Sell the right service at the right price without overbooking the operation.',
    items: [
      'Boarding, daycare, grooming, and training requests',
      'Resource and staff-aware availability',
      'Deposits, fees, discounts, taxes, and add-ons',
      'Seasonal, holiday, pet, service, and location rules',
      'Waitlists and capacity recovery',
      'Recurring appointments and attendance',
      'Quotes, approvals, changes, and cancellations',
      'Immutable price and policy snapshots',
    ],
  },
  {
    title: 'Pet and customer intelligence',
    lead: 'One usable history that follows the family through every service.',
    items: [
      'Households, contacts, authorized pickup, and veterinarians',
      'Pet identity, breed, photos, alerts, and documents',
      'Vaccinations and expiration tracking',
      'Feeding, medication, allergy, and care plans',
      'Behavior, temperament, compatibility, and restrictions',
      'Service, payment, communication, and incident history',
      'Consent, communication preferences, notes, and tags',
      'Duplicate detection and controlled record merging',
    ],
  },
  {
    title: 'Daily care and safety',
    lead: 'Give staff a live operating layer for exceptional, accountable care.',
    items: [
      'Universal check-in and checkout',
      'Kennel and suite assignments',
      'Feeding and medication task engines',
      'Playgroups, rotations, rest, and enrichment',
      'Wellness observations and trend alerts',
      'Incidents, evidence, escalation, and corrective action',
      'Cleaning, sanitation, inspection, and turnover',
      'Shift handovers, task SLAs, and digital report cards',
    ],
  },
  {
    title: 'Revenue and customer growth',
    lead: 'Connect the transaction to retention instead of treating payment as the finish line.',
    items: [
      'Invoices, deposits, refunds, credits, and reconciliation',
      'Memberships, packages, passes, benefits, and usage ledgers',
      'Gift cards, coupons, promotions, and loyalty rewards',
      'Email, SMS, push, and in-app communication',
      'Lifecycle journeys and abandoned-booking recovery',
      'Reviews, referrals, campaigns, and segmentation',
      'Customer self-service and secure messaging',
      'Retail catalog, POS, inventory, and purchasing',
    ],
  },
  {
    title: 'Teams, locations, and insight',
    lead: 'Local teams move quickly while owners keep clear control.',
    items: [
      'Role and location-scoped access',
      'Staff schedules, skills, availability, and assignments',
      'Multi-location services, hours, pricing, and resources',
      'Executive operations dashboard and alert center',
      'Occupancy, revenue, retention, utilization, and care KPIs',
      'Audit history, exports, and configurable reports',
      'Facility, asset, maintenance, and vendor operations',
      'API, webhooks, imports, integrations, and platform administration',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="relative overflow-hidden border-b border-[#dbe7f5]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_0%,rgba(191,219,254,.8),transparent_35rem)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#2563eb]">
            Complete capability map
          </p>
          <h1 className="mt-5 max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-7xl">
            From first impression to final care task.
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#40516a]">
            Roventra is designed to replace the seams between website, booking, customer records,
            care delivery, payments, team coordination, and business insight.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white"
              href="/pricing"
            >
              Explore plans
            </Link>
            <Link
              className="rounded-xl border border-[#b8cce5] bg-white px-6 py-3.5 text-sm font-bold"
              href="/solutions"
            >
              Browse by service
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-6">
          {capabilityGroups.map((group, groupIndex) => (
            <article
              className="grid gap-8 rounded-[30px] border border-[#dbe7f5] bg-white p-7 lg:grid-cols-[.75fr_1.25fr] lg:p-10"
              key={group.title}
            >
              <div>
                <span className="text-xs font-black text-[#2563eb]">0{groupIndex + 1}</span>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-.04em]">{group.title}</h2>
                <p className="mt-4 leading-7 text-[#40516a]">{group.lead}</p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => (
                  <li
                    className="flex gap-3 rounded-2xl bg-[#f3f7fd] px-4 py-3 text-sm font-semibold text-[#263a55]"
                    key={item}
                  >
                    <span className="text-[#2563eb]">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section className="border-y border-[#dbe7f5] bg-[#eaf3ff]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#1d4ed8]">
              Our defining advantage
            </p>
            <h2 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-.045em]">
              The customer never falls out of your brand to use your software.
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-[#40516a]">
              The public website, booking flow, registration, pet profiles, payments, messages, and
              portal share the business’s chosen theme and content system.
            </p>
          </div>
          <Link
            className="rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white"
            href="/solutions/website-builder"
          >
            See the website platform
          </Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
