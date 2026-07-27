import { describe, expect, it } from 'vitest';

import { Card } from './card';

describe('Card', () => {
  it('groups section context, title, description, and actions in a responsive header', () => {
    const element = Card({
      actions: '3 records',
      children: 'Records',
      description: 'Authoritative customer records.',
      eyebrow: 'Customer directory',
      title: 'Customers',
      tone: 'accent',
    });
    const [header, body] = element.props.children;
    const [summary, actions] = header.props.children;

    expect(element.props.className).toContain('border-blue-100');
    expect(summary.props.children[0].props.children).toBe('Customer directory');
    expect(summary.props.children[1].props.children).toBe('Customers');
    expect(actions.props.children).toBe('3 records');
    expect(body.props.children).toBe('Records');
  });

  it('keeps unheaded content free of empty header markup', () => {
    const element = Card({ children: 'Standalone content' });
    const [header, body] = element.props.children;

    expect(header).toBeNull();
    expect(body.props.className).toBe('');
  });
});
