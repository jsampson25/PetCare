import Link from 'next/link';

export function MarketingCta({
  eyebrow = 'Try the connected experience',
  title = 'Build the business your customers already expect.',
}: {
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section className="border-y border-[#cfe0f4] bg-[linear-gradient(120deg,#eaf3ff_0%,#f3f8ff_48%,#e0f2fe_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#1d4ed8]">{eyebrow}</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.045em] text-[#0b1f3a]">
            {title}
          </h2>
          <p className="mt-4 text-sm font-semibold text-[#40516a]">
            14 days free · No credit card required · Guided setup included
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="rounded-xl bg-[#2563eb] px-6 py-3.5 text-center text-sm font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,.22)]"
            href="/auth/register?plan=growth&trial=14"
          >
            Start free trial
          </Link>
          <Link
            className="rounded-xl border border-[#b8cce5] bg-white px-6 py-3.5 text-center text-sm font-bold text-[#18324f]"
            href="/demo"
          >
            Request a walkthrough
          </Link>
        </div>
      </div>
    </section>
  );
}
