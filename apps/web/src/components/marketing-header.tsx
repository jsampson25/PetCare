import Link from 'next/link';

export function MarketingHeader() {
  return (
    <header className="relative z-20 border-b border-[#e6ebe7] bg-[#fbfcfa]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/" aria-label="Roventra home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#173f32] text-sm font-black text-white">
            R
          </span>
          <span className="text-xl font-semibold tracking-[-0.035em]">Roventra</span>
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm font-semibold text-[#536159] md:flex"
          aria-label="Marketing navigation"
        >
          <Link className="transition hover:text-[#173f32]" href="/#platform">
            Platform
          </Link>
          <Link className="transition hover:text-[#173f32]" href="/pricing">
            Pricing
          </Link>
          <Link className="transition hover:text-[#173f32]" href="/auth/sign-in">
            Sign in
          </Link>
          <Link
            className="rounded-xl bg-[#173f32] px-5 py-3 text-white transition hover:bg-[#0d3227]"
            href="/pricing"
          >
            Get started
          </Link>
        </nav>
        <Link
          className="rounded-xl bg-[#173f32] px-4 py-2.5 text-sm font-bold text-white md:hidden"
          href="/pricing"
        >
          Plans
        </Link>
      </div>
    </header>
  );
}
