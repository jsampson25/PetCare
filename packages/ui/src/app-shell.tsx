import type { CSSProperties, ReactNode } from 'react';

import { visibleNavigation, type NavigationItem } from './navigation';
import { ShellNavigation } from './shell-navigation';

type ShellKind = 'business' | 'customer' | 'platform';

const shellNames: Record<ShellKind, string> = {
  business: 'Business workspace',
  customer: 'Customer portal',
  platform: 'Platform console',
};

export function AppShell({
  accountDetail,
  accountHref,
  accountName = 'Signed-in user',
  children,
  contextLabel,
  items,
  kind,
  permissions = new Set<string>(),
  brandName = 'Roventra',
  brandLogoAlt,
  brandLogoMode = 'mark',
  brandLogoUrl,
  brandTokens,
}: {
  accountDetail?: string;
  accountHref?: string;
  accountName?: string;
  children: ReactNode;
  contextLabel: string;
  items: readonly NavigationItem[];
  kind: ShellKind;
  permissions?: ReadonlySet<string>;
  brandName?: string;
  brandLogoAlt?: string;
  brandLogoMode?: 'lockup' | 'mark';
  brandLogoUrl?: string;
  brandTokens?: { primary?: string; primaryText?: string; accent?: string };
}) {
  const navigation = visibleNavigation(items, permissions);
  const accountParts = accountName.trim().split(/\s+/).filter(Boolean);
  const accountInitials =
    accountParts.length > 1
      ? `${accountParts[0]?.[0] ?? ''}${accountParts.at(-1)?.[0] ?? ''}`.toUpperCase()
      : (accountParts[0]?.slice(0, 2).toUpperCase() ?? 'SU');
  const accountContents = (
    <>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700"
        aria-hidden="true"
      >
        {accountInitials}
      </span>
      <span className="hidden min-w-0 text-left sm:block">
        <span className="block max-w-40 truncate text-sm font-bold text-[var(--text-primary)]">
          {accountName}
        </span>
        {accountDetail ? (
          <span className="block max-w-40 truncate text-[0.68rem] text-[var(--text-muted)]">
            {accountDetail}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <div
      className={`min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr] shell-${kind} ${kind === 'customer' ? 'customer-canvas' : ''}`}
      style={
        {
          '--action-primary': brandTokens?.primary,
          '--action-primary-text': brandTokens?.primaryText,
          '--focus-ring': brandTokens?.accent,
        } as CSSProperties
      }
    >
      <aside className="border-b border-slate-800 bg-[#0b1f3a] px-4 py-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-4 lg:py-5">
        <div className="flex items-center justify-between lg:block">
          <div>
            <a
              className="flex min-h-10 items-center gap-3 text-lg font-extrabold tracking-tight"
              href="/"
            >
              <span
                aria-label={brandLogoUrl ? brandLogoAlt || `${brandName} logo` : undefined}
                className={`grid place-items-center text-base font-black ${
                  brandLogoUrl
                    ? `bg-contain bg-left bg-no-repeat ${brandLogoMode === 'lockup' ? 'h-10 w-36' : 'size-10'}`
                    : 'size-10 rounded-2xl bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-sm'
                }`}
                aria-hidden={brandLogoUrl ? undefined : 'true'}
                role={brandLogoUrl ? 'img' : undefined}
                style={{ backgroundImage: brandLogoUrl ? `url(${brandLogoUrl})` : undefined }}
              >
                {brandLogoUrl ? null : brandName.slice(0, 2).toUpperCase()}
              </span>
              {brandLogoUrl && brandLogoMode === 'lockup' ? null : (
                <span className="text-white">{brandName}</span>
              )}
            </a>
            <p
              className={`${brandLogoUrl && brandLogoMode === 'lockup' ? 'ml-0 mt-1' : 'ml-[3.25rem] mt-[-0.35rem]'} text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400`}
            >
              {shellNames[kind]}
            </p>
          </div>
          <div className="max-w-40 lg:mt-7 lg:max-w-full lg:rounded-xl lg:border lg:border-white/10 lg:bg-white/[.06] lg:p-3">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] opacity-60">
              Viewing
            </p>
            <p className="mt-1 truncate text-sm font-bold">{contextLabel}</p>
          </div>
        </div>
        <details className="mt-5 rounded-xl border border-white/15 lg:hidden">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-bold">
            Open navigation
          </summary>
          <div className="max-h-[70vh] overflow-y-auto border-t border-white/15">
            <ShellNavigation items={navigation} mobile name={shellNames[kind]} />
          </div>
        </details>
        <div className="mt-6 hidden min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:#334155_transparent] [scrollbar-width:thin] lg:block">
          <ShellNavigation items={navigation} name={shellNames[kind]} />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {shellNames[kind]}
            </p>
            <p className="mt-0.5 text-sm font-semibold">{contextLabel}</p>
          </div>
          {accountHref ? (
            <a
              aria-label={`Account: ${accountName}`}
              className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-default)] px-2.5 py-1.5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40"
              href={accountHref}
            >
              {accountContents}
            </a>
          ) : (
            <span
              aria-label={`Signed in as ${accountName}`}
              className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-default)] px-2.5 py-1.5 shadow-sm"
            >
              {accountContents}
            </span>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
