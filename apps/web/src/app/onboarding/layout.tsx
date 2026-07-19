import Link from 'next/link';
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#eef5f0,#fbfcfa_45%,#f7efdf)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link className="mb-8 flex items-center gap-3 text-xl font-black" href="/">
          <span
            className="grid size-11 place-items-center rounded-2xl bg-[var(--action-primary)] text-white shadow-lg"
            aria-hidden="true"
          >
            P
          </span>
          PetCare
        </Link>
        {children}
      </div>
    </main>
  );
}
