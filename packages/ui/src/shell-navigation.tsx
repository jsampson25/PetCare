'use client';

import { useEffect, useState } from 'react';

import { Icon } from './icon';
import type { NavigationItem } from './navigation';

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
                  <Icon name={item.icon ?? 'home'} size="sm" />
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
