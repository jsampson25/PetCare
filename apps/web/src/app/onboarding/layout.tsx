import Link from 'next/link';
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--surface-subtle)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link className="mb-7 block text-xl font-black" href="/">
          PetCare
        </Link>
        {children}
      </div>
    </main>
  );
}
