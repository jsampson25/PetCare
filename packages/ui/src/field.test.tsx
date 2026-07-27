import { describe, expect, it } from 'vitest';

import { Field } from './field';

describe('Field', () => {
  it('supports compact command-bar inputs while preserving accessible errors', () => {
    const element = Field({
      density: 'compact',
      error: 'Enter a booking number.',
      label: 'Booking number',
      name: 'bookingNumber',
    });
    const input = element.props.children[2];

    expect(input.props.className).toContain('min-h-11');
    expect(input.props['aria-invalid']).toBe(true);
    expect(input.props['aria-describedby']).toBe('bookingNumber-description');
  });
});
