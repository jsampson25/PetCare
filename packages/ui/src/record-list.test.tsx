import { describe, expect, it } from 'vitest';

import { RecordList, RecordListItem } from './record-list';

describe('RecordList', () => {
  it('uses list semantics for responsive record collections', () => {
    const element = RecordList({ children: 'Records' });

    expect(element.type).toBe('ul');
    expect(element.props.role).toBe('list');
    expect(element.props.className).toContain('divide-y');
  });

  it('groups identity, status, and action content in one record item', () => {
    const element = RecordListItem({
      action: 'Open record',
      description: 'Customer and location',
      leading: 'Avatar',
      status: 'Confirmed',
      title: 'PC-000123',
    });
    const [identity, controls] = element.props.children;

    expect(element.type).toBe('li');
    expect(identity.props.children[0].props.children).toBe('Avatar');
    expect(identity.props.children[1].props.children[0].props.children).toBe('PC-000123');
    expect(controls.props.children).toEqual(['Confirmed', 'Open record']);
  });
});
