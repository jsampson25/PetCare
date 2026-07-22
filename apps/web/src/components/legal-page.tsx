import type { ReactNode } from 'react';
import { MarketingFooter } from './marketing-footer';
import { MarketingHeader } from './marketing-header';

export function LegalPage({
  children,
  description,
  title,
  updated = 'July 21, 2026',
}: {
  children: ReactNode;
  description: string;
  title: string;
  updated?: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7faff] text-[#0b1f3a]">
      <MarketingHeader />
      <header className="border-b border-[#dbe7f5] bg-[radial-gradient(circle_at_80%_10%,#dbeafe_0,transparent_34rem)] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#2563eb]">Legal</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-.045em] sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#52627a]">{description}</p>
          <p className="mt-5 text-sm font-semibold text-[#6b7b91]">Last updated {updated}</p>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-6 py-14 text-[#31435c] [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-.025em] [&_li]:mb-2 [&_p]:mb-4 [&_p]:leading-7 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>
      <MarketingFooter />
    </main>
  );
}
