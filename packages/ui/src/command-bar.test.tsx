import { describe, expect, it } from 'vitest';

import { CommandBar } from './command-bar';

describe('CommandBar', () => {
  it('groups its heading, controls, and secondary action accessibly', () => {
    const element = CommandBar({
      children: 'Primary controls',
      description: 'Narrow the current operational view.',
      secondaryAction: 'Secondary action',
      title: 'Find bookings',
    });
    const [summary, controls, secondary] = element.props.children;

    expect(element.type).toBe('section');
    expect(element.props['aria-label']).toBe('Find bookings controls');
    expect(summary.props.children[1].props.children).toBe('Find bookings');
    expect(controls.props.children).toBe('Primary controls');
    expect(secondary.props.children).toBe('Secondary action');
  });

  it('omits optional content without empty secondary regions', () => {
    const element = CommandBar({ children: 'Filters', title: 'Filter invoices' });
    const [summary, , secondary] = element.props.children;

    expect(summary.props.children[2]).toBeNull();
    expect(secondary).toBeNull();
  });
});
