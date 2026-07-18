import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-subtle)] px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          className="mb-6 block text-center text-xl font-black text-[var(--text-primary)]"
          href="/"
        >
          PetCare
        </Link>
        {children}
      </div>
    </main>
  );
}
