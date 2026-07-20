import type { Metadata } from 'next';

import { MarketingCta } from '../../components/marketing-cta';
import { MarketingFooter } from '../../components/marketing-footer';
import { MarketingHeader } from '../../components/marketing-header';

export const metadata: Metadata = {
  title: 'Integrations',
  description: 'Connect Roventra with the services your pet-care business already trusts.',
};

const groups = [
  ['Payments and accounting', 'Stripe', 'Square', 'QuickBooks', 'Xero'],
  ['Communication', 'Resend', 'Twilio', 'Mailchimp', 'WhatsApp'],
  ['Calendars and productivity', 'Google Calendar', 'Outlook', 'Apple Calendar', 'Zapier'],
  ['Growth and reputation', 'Google Business Profile', 'Google Reviews', 'Facebook', 'Instagram'],
  ['Data and migration', 'Gingr import', 'PetExec import', 'Kennel Connection import', 'CSV tools'],
  ['Developer platform', 'REST API', 'Webhooks', 'Event subscriptions', 'Secure service accounts'],
];

export default function IntegrationsPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-[#0b1f3a]">
      <MarketingHeader />
      <section className="border-b border-[#dbe7f5] bg-[radial-gradient(circle_at_70%_15%,#bfdbfe,transparent_34rem)]">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#2563eb]">
            Connected by design
          </p>
          <h1 className="mx-auto mt-5 max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-7xl">
            Keep the tools you trust. Lose the disconnected work.
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-[#40516a]">
            Roventra becomes the operating source of truth while secure integrations move payments,
            messages, calendars, accounting data, and customer activity where they belong.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(([title, ...items]) => (
            <article className="rounded-[26px] border border-[#dbe7f5] bg-white p-7" key={title}>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f1ff] text-lg font-black text-[#2563eb]">
                +
              </div>
              <h2 className="mt-6 text-xl font-semibold">{title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {items.map((item) => (
                  <span
                    className="rounded-full border border-[#dbe7f5] bg-[#f5f9ff] px-3 py-2 text-xs font-bold text-[#40516a]"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[#52627a]">
          Integration availability varies by plan and release stage. Every connection is reviewed
          for security, consent, and tenant isolation.
        </p>
      </section>
      <MarketingCta
        eyebrow="Connect your workflow"
        title="One platform does not have to mean starting over."
      />
      <MarketingFooter />
    </main>
  );
}
