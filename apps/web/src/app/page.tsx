import { ButtonLink } from '@petcare/ui/button-link';

const capabilities = [
  ['Simple booking', 'Customers can reserve boarding, daycare, and grooming in one clear flow.'],
  ['Complete pet profiles', 'Vaccines, feeding, medication, behavior, and care instructions stay together.'],
  ['Daily operations', 'Staff see arrivals, departures, care work, exceptions, and capacity in one place.'],
];

export default function HomePage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a className="text-xl font-bold tracking-tight" href="/" aria-label="PetCare home">
          PetCare
        </a>
        <nav aria-label="Primary navigation" className="flex items-center gap-5 text-sm font-medium">
          <a href="#platform">Platform</a>
          <ButtonLink href="/auth/sign-in" variant="secondary">
            Sign in
          </ButtonLink>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[var(--brand)]">
            Pet care, connected
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-[-0.045em] sm:text-6xl">
            A calmer way to run a pet care business.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Bring reservations, pet records, payments, customer updates, and daily care into one
            modern workspace.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/book">Book a stay</ButtonLink>
            <ButtonLink href="/portal" variant="secondary">
              Customer portal
            </ButtonLink>
          </div>
        </div>

        <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(30,55,42,0.10)]">
          <p className="text-sm font-semibold text-[var(--muted)]">Today at a glance</p>
          <p className="mt-2 text-3xl font-bold">Everything that needs care</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[['Arrivals', '8'], ['In care', '34'], ['Tasks due', '12'], ['Departures', '6']].map(
              ([label, value]) => (
                <div className="rounded-2xl bg-[var(--accent)] p-4" key={label}>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{label}</p>
                </div>
              ),
            )}
          </div>
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
            Demonstration content for the initial application shell. Live business data comes in a
            later milestone.
          </p>
        </aside>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface)]" id="platform">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 py-16 md:grid-cols-3">
          {capabilities.map(([title, description]) => (
            <article className="rounded-2xl border border-[var(--border)] p-6" key={title}>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
