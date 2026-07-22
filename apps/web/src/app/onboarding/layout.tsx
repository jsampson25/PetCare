import Link from 'next/link';
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(191,219,254,.65),transparent_28rem),linear-gradient(145deg,#f7faff,#eef6ff)] px-4 py-6 text-[#0b1f3a] [--action-primary:#2563eb] [--action-primary-active:#1e40af] [--action-primary-hover:#1d4ed8] [--border-default:#dbe7f5] [--border-strong:#b8cce5] [--focus-ring:#2563eb] [--link-default:#1d4ed8] [--surface-canvas:#f7faff] [--surface-subtle:#eef5ff] [--text-primary:#0b1f3a] [--text-secondary:#52627a] sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between py-3">
        <Link className="flex items-center gap-3 text-xl font-semibold tracking-[-.035em]" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2563eb] text-sm font-black text-white shadow-[0_8px_24px_rgba(37,99,235,.24)]">
            R
          </span>
          Roventra
        </Link>
        <div className="hidden items-center gap-3 text-xs font-bold text-[#52627a] sm:flex">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
          Your setup saves as you go
        </div>
      </header>
      <div className="mx-auto max-w-6xl py-8 sm:py-12">{children}</div>
    </main>
  );
}
