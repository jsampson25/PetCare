import type { Metadata } from 'next';

import { MarketingCta } from '../../components/marketing-cta';
import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';

export const metadata: Metadata = {
  title: 'Security',
  description: 'How Roventra protects pet-care businesses, staff, customers, and operational data.',
};
const pillars = [
  [
    'Tenant isolation',
    'Business data is scoped to the correct organization and location through enforced access policies.',
  ],
  [
    'Role-based access',
    'Owners control what managers, front-desk teams, caregivers, groomers, and auditors can see and change.',
  ],
  [
    'Strong authentication',
    'Verified email, secure password handling, MFA-ready workflows, and protected session controls.',
  ],
  [
    'Accountable activity',
    'Sensitive operational, financial, and administrative changes create durable audit history.',
  ],
  [
    'Payment boundaries',
    'Card handling stays with qualified payment providers rather than inside ordinary application data.',
  ],
  [
    'Resilience and recovery',
    'Backups, monitoring, controlled releases, and recovery procedures are designed into the platform.',
  ],
];
export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-[#0b1f3a]">
      <MarketingHeader />
      <section className="bg-[#0b1f3a] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#7dd3fc]">
            Trust is operational
          </p>
          <h1 className="mt-5 max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-7xl">
            Security that follows every reservation, record, and role.
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-white/75">
            Roventra is being built with security boundaries that match real pet-care work—not as a
            checklist added after launch.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map(([title, description], index) => (
            <article
              className="rounded-[26px] border border-[#dbe7f5] bg-[#f8fbff] p-7"
              key={title}
            >
              <span className="text-xs font-black text-[#2563eb]">0{index + 1}</span>
              <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
              <p className="mt-4 leading-7 text-[#40516a]">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 rounded-[28px] border border-[#bfdbfe] bg-[#eaf3ff] p-8 lg:flex lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Clear answers for your security review</h2>
            <p className="mt-3 max-w-2xl leading-7 text-[#40516a]">
              Architecture, access, data retention, incident response, and vendor controls can be
              reviewed during guided onboarding.
            </p>
          </div>
          <a
            className="mt-6 inline-block rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white lg:mt-0"
            href="mailto:security@getroventra.com"
          >
            Contact security
          </a>
        </div>
      </section>
      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
