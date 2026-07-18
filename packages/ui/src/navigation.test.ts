import { describe, expect, it } from 'vitest';

import { visibleNavigation, type NavigationItem } from './navigation';

const items: NavigationItem[] = [
  { href: '/app', label: 'Today' },
  { href: '/app/customers', label: 'Customers', requiredPermissions: ['customers.read'] },
  { href: '/app/settings', label: 'Settings', requiredPermissions: ['business.manage'] },
];

describe('visibleNavigation', () => {
  it('keeps public items and items with every required permission', () => {
    expect(visibleNavigation(items, new Set(['customers.read'])).map(({ label }) => label)).toEqual(
      ['Today', 'Customers'],
    );
  });

  it('does not treat hidden navigation as authorization', () => {
    expect(visibleNavigation(items, new Set())).toEqual([{ href: '/app', label: 'Today' }]);
  });
});
