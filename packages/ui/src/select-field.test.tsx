import { describe, expect, it } from 'vitest';

import { SelectField } from './select-field';

describe('SelectField', () => {
  it('links its visible label and compact native select', () => {
    const element = SelectField({
      children: 'Options',
      density: 'compact',
      label: 'Status',
      name: 'status',
    });
    const [label, , select] = element.props.children;

    expect(label.props.htmlFor).toBe('status');
    expect(select.props.id).toBe('status');
    expect(select.props.className).toContain('min-h-11');
  });

  it('requires a stable id for accessible labeling', () => {
    expect(() => SelectField({ children: 'Options', label: 'Status' })).toThrow(
      'SelectField requires an id or name.',
    );
  });
});
