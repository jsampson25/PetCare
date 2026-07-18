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
      className={`min-h-screen lg:grid lg:grid-cols-[17rem_1fr] shell-${kind}`}
      style={
        {
          '--action-primary': brandTokens?.primary,
          '--focus-ring': brandTokens?.accent,
        } as CSSProperties
      }
    >
      <aside className="border-b border-[var(--border-default)] bg-[var(--shell-background)] px-5 py-5 text-[var(--shell-foreground)] lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:block">
          <div>
            <a className="text-lg font-bold" href="/">
              {brandName}
            </a>
            <p className="mt-1 text-xs font-semibold opacity-75">{shellNames[kind]}</p>
          </div>
          <p className="max-w-36 truncate text-sm font-bold lg:mt-8 lg:max-w-full">
            {contextLabel}
          </p>
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
              className="block min-h-11 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-semibold hover:bg-[var(--shell-hover)]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b border-[var(--border-default)] bg-[var(--surface-default)] px-5 sm:px-8">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">{shellNames[kind]}</p>
          <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1.5 text-sm font-semibold">
            Demo user
          </span>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
