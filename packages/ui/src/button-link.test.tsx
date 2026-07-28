import { describe, expect, it } from 'vitest';

import { ButtonLink } from './button-link';

describe('ButtonLink', () => {
  it('keeps a leading icon and label in one spaced action', () => {
    const icon = <span aria-hidden="true">icon</span>;
    const element = ButtonLink({ children: 'Open', href: '/records', leadingIcon: icon });

    expect(element.props.className).toContain('gap-2');
    expect(element.props.children[0]).toBe(icon);
    expect(element.props.children[1].props.children).toBe('Open');
  });
});
