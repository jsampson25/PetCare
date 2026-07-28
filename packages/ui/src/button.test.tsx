import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('places a leading icon before the visible label', () => {
    const icon = <span aria-hidden="true">icon</span>;
    const element = Button({ children: 'Save', leadingIcon: icon });

    expect(element.props.children[0]).toBe(icon);
    expect(element.props.children[1].props.children).toBe('Save');
  });

  it('replaces the leading icon with progress while loading', () => {
    const element = Button({ children: 'Save', leadingIcon: 'icon', loading: true });

    expect(element.props['aria-busy']).toBe(true);
    expect(element.props.children[0].props.className).toContain('animate-spin');
    expect(element.props.children[1].props.children).toBe(`Working${String.fromCharCode(8230)}`);
  });
});
