import { describe, expect, it } from 'vitest';

import { Icon } from './icon';

describe('Icon', () => {
  it('is decorative by default when adjacent text names the action', () => {
    const element = Icon({ name: 'add', size: 'sm' });

    expect(element.props['aria-hidden']).toBe('true');
    expect(element.props['aria-label']).toBeUndefined();
    expect(element.props.role).toBeUndefined();
    expect(element.props.className).toContain('size-[1.15rem]');
  });

  it('can expose a standalone icon with an accessible name', () => {
    const element = Icon({ label: 'Add record', name: 'add' });

    expect(element.props['aria-hidden']).toBeUndefined();
    expect(element.props['aria-label']).toBe('Add record');
    expect(element.props.role).toBe('img');
  });
});
