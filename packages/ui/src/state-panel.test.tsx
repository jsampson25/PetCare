import { describe, expect, it } from 'vitest';

import { StatePanel } from './state-panel';

describe('StatePanel', () => {
  it('supports a compact empty state without changing the default contract', () => {
    const compact = StatePanel({
      description: 'Adjust the filters or create the first record.',
      size: 'compact',
      title: 'No results',
    });
    const standard = StatePanel({ description: 'Try again later.', title: 'Unavailable' });

    expect(compact.props.className).toContain('py-6');
    expect(compact.props.children[0].props.className).toContain('text-base');
    expect(standard.props.className).toContain('py-10');
    expect(standard.props.children[0].props.className).toContain('text-lg');
  });
});
