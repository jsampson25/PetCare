import { describe, expect, it } from 'vitest';

import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders its hierarchy and optional actions through one shared contract', () => {
    const element = PageHeader({
      actions: '4 expected',
      description: 'Review the pets expected today.',
      eyebrow: 'Operations',
      title: 'Arrivals',
    });
    const [summary, actions] = element.props.children;

    expect(element.type).toBe('header');
    expect(element.props.className).toContain('border-b');
    expect(summary.props.children[0].props.children).toBe('Operations');
    expect(summary.props.children[1].props.children).toBe('Arrivals');
    expect(summary.props.children[2].props.children).toBe('Review the pets expected today.');
    expect(actions.props.children).toBe('4 expected');
  });

  it('omits optional content without leaving empty containers', () => {
    const element = PageHeader({ eyebrow: 'Finance', title: 'Invoices' });
    const [summary, actions] = element.props.children;

    expect(summary.props.children[2]).toBeNull();
    expect(actions).toBeNull();
  });
});
