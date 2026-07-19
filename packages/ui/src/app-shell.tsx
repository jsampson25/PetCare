import type { CSSProperties, ReactNode } from 'react';

import { visibleNavigation, type NavigationItem } from './navigation';

type ShellKind = 'business' | 'customer' | 'platform';

const shellNames: Record<ShellKind, string> = {
  business: 'Business workspace',
  customer: 'Customer portal',
  platform: 'Platform console',
};

export function AppShell({
  children,
  contextLabel,
  items,
  kind,
  permissions = new Set<string>(),
  brandName = 'PetCare',
  brandTokens,
}: {
  children: ReactNode;
  contextLabel: string;
  items: readonly NavigationItem[];
  kind: ShellKind;
  permissions?: ReadonlySet<string>;
  brandName?: string;
  brandTokens?: { primary?: string; accent?: string };
}) {
  const navigation = visibleNavigation(items, permissions);

  return (
    <div
      className={`min-h-screen lg:grid lg:grid-cols-[18rem_1fr] shell-${kind} ${kind === 'customer' ? 'customer-canvas' : ''}`}
      style={
        {
          '--action-primary': brandTokens?.primary,
          '--focus-ring': brandTokens?.accent,
        } as CSSProperties
      }
    >
      <aside className="border-b border-[var(--border-default)] bg-[var(--shell-background)] px-5 py-5 text-[var(--shell-foreground)] lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
        <div className="flex items-center justify-between lg:block">
          <div>
            <a className="flex items-center gap-3 text-lg font-extrabold tracking-tight" href="/">
              <span
                className="grid size-10 place-items-center rounded-2xl bg-[var(--action-primary)] text-base text-white shadow-sm"
                aria-hidden="true"
              >
                P
              </span>
              <span>{brandName}</span>
            </a>
            <p className="ml-[3.25rem] mt-[-0.35rem] text-[0.68rem] font-bold uppercase tracking-[0.16em] opacity-65">
              {shellNames[kind]}
            </p>
          </div>
          <div className="max-w-40 lg:mt-9 lg:max-w-full lg:rounded-2xl lg:border lg:border-current/10 lg:bg-white/35 lg:p-3.5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] opacity-60">
              Viewing
            </p>
            <p className="mt-1 truncate text-sm font-bold">{contextLabel}</p>
          </div>
        </div>
        <details className="mt-5 rounded-[var(--radius-md)] border border-current/20 lg:hidden">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-bold">
            Open navigation
          </summary>
          <nav
            aria-label={`${shellNames[kind]} mobile navigation`}
            className="border-t border-current/20 p-2"
          >
            {navigation.map((item) => (
              <a
                className="block min-h-11 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-semibold hover:bg-[var(--shell-hover)]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </details>
        <nav
          aria-label={`${shellNames[kind]} navigation`}
          className="mt-6 hidden space-y-1 lg:block"
        >
          {navigation.map((item) => (
            <a
              className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-[var(--shell-hover)]"
              href={item.href}
              key={item.href}
            >
              <span
                className="size-1.5 rounded-full bg-current opacity-35 transition group-hover:opacity-80"
                aria-hidden="true"
              />
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-[4.5rem] items-center justify-between border-b border-[var(--border-default)] bg-white/85 px-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {shellNames[kind]}
            </p>
            <p className="mt-0.5 text-sm font-semibold">{contextLabel}</p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-default)] px-2.5 py-1.5 text-sm font-semibold shadow-sm">
            <span
              className="grid size-7 place-items-center rounded-full bg-[var(--surface-subtle)] text-xs"
              aria-hidden="true"
            >
              DU
            </span>
            <span className="hidden sm:inline">Demo user</span>
          </span>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
