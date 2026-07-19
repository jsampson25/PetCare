import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import type { CSSProperties } from 'react';
import { createSupabaseServerClient } from '../../lib/supabase/server';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { robots: { index: false, follow: false } };

export default async function BookPage({ searchParams }: { searchParams: SearchParameters }) {
  const query = await searchParams;
  const tenant = typeof query.tenant === 'string' ? query.tenant : '';
  const supabase = await createSupabaseServerClient();
  const { data: site } = tenant
    ? await supabase.rpc('get_public_tenant_website', { public_slug_value: tenant })
    : { data: null };
  if (!site)
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--surface-canvas)] px-6">
        <Card className="max-w-lg" title="Choose your pet-care business">
          <p className="leading-7 text-[var(--text-secondary)]">
            Open booking from a business&apos;s published website so its services, branding, and
            secure customer portal remain connected.
          </p>
          <div className="mt-5">
            <ButtonLink href="/">Return home</ButtonLink>
          </div>
        </Card>
      </main>
    );
  return (
    <main
      className="min-h-screen bg-[linear-gradient(135deg,#f4f8f5,#fff)] text-slate-950"
      style={{ '--action-primary': site.brand_tokens.primary } as CSSProperties}
    >
      <header className="border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between px-6">
          <a className="flex items-center gap-3 font-black" href={`/site/${site.business.slug}`}>
            <span className="grid size-10 place-items-center rounded-2xl bg-[var(--action-primary)] text-white">
              P
            </span>
            {site.business.name}
          </a>
          <a className="text-sm font-bold text-slate-600" href="/portal">
            Customer sign in
          </a>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[0.7fr_1.3fr]">
        <aside>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--action-primary)]">
            Online booking
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
            What kind of care does your pet need?
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            Start with a service. We will confirm your pet, dates, eligibility, availability, and
            final price before anything is booked.
          </p>
          <ol className="mt-8 space-y-4">
            {[
              'Choose care',
              'Sign in or create an account',
              'Select pet and dates',
              'Review and confirm',
            ].map((label, index) => (
              <li className="flex items-center gap-3 text-sm font-bold" key={label}>
                <span
                  className={`grid size-8 place-items-center rounded-full ${index === 0 ? 'bg-[var(--action-primary)] text-white' : 'border border-slate-300 bg-white text-slate-500'}`}
                >
                  {index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="font-black text-emerald-900">Your information stays connected</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Vaccinations, pet profiles, reservation updates, invoices, and report cards remain
              available in your secure portal.
            </p>
          </div>
        </aside>
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Step 1 of 4
              </p>
              <h2 className="mt-1 text-2xl font-black">Choose a service</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm">
              {site.services.length} options
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {site.services.map(
              (service: { name: string; description: string; category: string }, index: number) => (
                <article
                  className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(30,55,42,.06)] transition hover:-translate-y-1 hover:border-[var(--action-primary)] hover:shadow-xl"
                  key={service.name}
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 font-black text-[var(--action-primary)]">
                      0{index + 1}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                      {service.category}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-black">{service.name}</h3>
                  <p className="mt-2 flex-1 leading-7 text-slate-600">{service.description}</p>
                  <ButtonLink
                    href={`/auth/sign-in?next=${encodeURIComponent('/portal/reservations')}`}
                  >
                    Choose {service.name}
                  </ButtonLink>
                </article>
              ),
            )}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account? Your saved pets and records will be ready after sign in.
          </p>
        </section>
      </div>
    </main>
  );
}
