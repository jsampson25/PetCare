import Link from 'next/link';

export function MarketingHeader() {
  const isPreview = process.env.VERCEL_ENV === 'preview';

  return (
    <header className="relative z-20 border-b border-[#dbe7f5] bg-white/90 backdrop-blur-xl">
      {isPreview ? (
        <div className="bg-[#0b1f3a] px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#bae6fd]">
          Roventra Beta Preview
        </div>
      ) : null}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/" aria-label="Roventra home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-sm font-black text-white shadow-[0_8px_24px_rgba(37,99,235,0.25)]">
            R
          </span>
          <span className="text-xl font-semibold tracking-[-0.035em]">Roventra</span>
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm font-semibold text-[#40516a] md:flex"
          aria-label="Marketing navigation"
        >
          <Link className="transition hover:text-[#1d4ed8]" href="/solutions">
            Solutions
          </Link>
          <Link className="transition hover:text-[#1d4ed8]" href="/features">
            Features
          </Link>
          <Link className="transition hover:text-[#1d4ed8]" href="/integrations">
            Integrations
          </Link>
          <Link className="transition hover:text-[#1d4ed8]" href="/pricing">
            Pricing
          </Link>
          <Link className="transition hover:text-[#1d4ed8]" href="/auth/sign-in">
            Sign in
          </Link>
          <Link
            className="rounded-xl bg-[#2563eb] px-5 py-3 text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
            href="/auth/register?plan=growth&trial=14"
          >
            Start free trial
          </Link>
        </nav>
        <Link
          className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white md:hidden"
          href="/auth/register?plan=growth&trial=14"
        >
          Try free
        </Link>
      </div>
    </header>
  );
}
