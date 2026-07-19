import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[linear-gradient(135deg,#eaf3ed,#fbfcfa_48%,#f6eddb)] px-4 py-10">
      <div
        className="absolute -left-20 -top-20 size-72 rounded-full bg-emerald-200/30"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -right-16 size-80 rounded-full bg-amber-200/25"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md">
        <Link
          className="mb-7 flex items-center justify-center gap-3 text-center text-xl font-black text-[var(--text-primary)]"
          href="/"
        >
          <span
            className="grid size-11 place-items-center rounded-2xl bg-[var(--action-primary)] text-white shadow-lg"
            aria-hidden="true"
          >
            P
          </span>
          <span>PetCare</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
