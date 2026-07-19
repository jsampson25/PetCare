import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#dbe7f5] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-[1fr_auto] sm:items-end lg:px-8">
        <div>
          <Link className="flex items-center gap-3" href="/">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563eb] text-xs font-black text-white">
              R
            </span>
            <span className="font-semibold">Roventra</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#52627a]">
            The connected website and operating platform for modern pet-care businesses.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#40516a]">
          <Link href="/#platform">Platform</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/auth/sign-in">Sign in</Link>
        </div>
      </div>
      <div className="border-t border-[#e7eef8] px-6 py-5 text-center text-xs text-[#52627a]">
        © 2026 Roventra. Built for exceptional pet care.
      </div>
    </footer>
  );
}
