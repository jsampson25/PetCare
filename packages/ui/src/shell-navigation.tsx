'use client';

import { useEffect, useState } from 'react';

import type { NavigationItem } from './navigation';

const paths: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6',
  calendar:
    'M6 3v3m12-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 7h3m2 0h3m-8 4h3m2 0h3',
  booking: 'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm4 9 2 2 4-5',
  arrivals: 'M4 12h12m-4-4 4 4-4 4m7-11v14',
  departures: 'M20 12H8m4-4-4 4 4 4M5 5v14',
  care: 'M12 21s-8-4.5-8-11a4 4 0 0 1 7-2.6A4 4 0 0 1 18 10c0 6.5-6 11-6 11Zm0-10v5m-2.5-2.5h5',
  clipboard: 'M9 5h6m-5-2h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1ZM7 5H5v16h14V5h-2m-8 6h6m-6 4h6',
  pets: 'M8.5 11C5 11 3 13.5 4 16.5c1 3 4.5 4 8 1.5 3.5 2.5 7 1.5 8-1.5 1-3-1-5.5-4.5-5.5-2 0-2.2 1-3.5 1s-1.5-1-3.5-1ZM6 8.5A2 2 0 1 0 6 4.5a2 2 0 0 0 0 4Zm5-2A2 2 0 1 0 11 2.5a2 2 0 0 0 0 4Zm7 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  users:
    'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6.5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8.5 1a3 3 0 0 1 3 3v2m-5-10a3 3 0 0 1 0 6',
  money: 'M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  website: 'M3 5h18v14H3V5Zm0 4h18M6 7h.01M9 7h.01',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a8 8 0 0 0-1.7-1L14.7 3h-4l-.4 3a8 8 0 0 0-1.7 1L6 6 4 9.4 6 11a7 7 0 0 0 0 2l-2 1.6L6 18l2.6-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.5 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z',
  shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-10 2 2 4-5',
  logout: 'M10 17l5-5-5-5m5 5H3m12-8h5v16h-5',
};

function NavigationIcon({ name = 'home' }: { name?: string }) {
  return (
    <svg aria-hidden="true" className="size-[1.15rem] shrink-0" fill="none" viewBox="0 0 24 24">
      <path
        d={paths[name] ?? paths.home}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function isCurrent(pathname: string, href: string) {
  if (href === '/app' || href === '/portal' || href === '/platform') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellNavigation({
  items,
  mobile = false,
  name,
}: {
  items: NavigationItem[];
  mobile?: boolean;
  name: string;
}) {
  const [pathname, setPathname] = useState('');
  useEffect(() => setPathname(window.location.pathname), []);
  const groups = items.reduce<Map<string, NavigationItem[]>>((result, item) => {
    const group = item.group ?? '';
    result.set(group, [...(result.get(group) ?? []), item]);
    return result;
  }, new Map());

  return (
    <nav aria-label={`${name} navigation`} className={mobile ? 'p-2' : 'pb-6'}>
      {[...groups.entries()].map(([group, links]) => (
        <section className={mobile ? 'mb-2' : 'mb-5'} key={group || 'main'}>
          {group ? (
            <p className="mb-1.5 px-3 text-[0.65rem] font-bold uppercase tracking-[.16em] text-slate-400">
              {group}
            </p>
          ) : null}
          <div className="space-y-1">
            {links.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <a
                  aria-current={current ? 'page' : undefined}
                  className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[0.82rem] font-semibold transition ${
                    current
                      ? 'bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,.28)]'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <NavigationIcon name={item.icon} />
                  <span className="truncate">{item.label}</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
