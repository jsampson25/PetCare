import { describe, expect, it } from 'vitest';
import {
  appendWebsiteEditorSnapshot,
  createWebsiteEditorSnapshot,
  readWebsiteEditorSnapshotValue,
  serializeWebsiteEditorSnapshot,
} from './website-editor-history';

describe('website editor history', () => {
  it('captures repeatable form values and reads a single value', () => {
    const formData = new FormData();
    formData.append('service', 'boarding');
    formData.append('service', 'daycare');
    formData.set('heroTitle', 'A happier stay');

    const snapshot = createWebsiteEditorSnapshot(formData);

    expect(snapshot).toEqual({
      heroTitle: ['A happier stay'],
      service: ['boarding', 'daycare'],
    });
    expect(readWebsiteEditorSnapshotValue(snapshot, 'heroTitle')).toBe('A happier stay');
    expect(readWebsiteEditorSnapshotValue(snapshot, 'missing')).toBe('');
  });

  it('serializes snapshots independently of field insertion order', () => {
    expect(serializeWebsiteEditorSnapshot({ theme: ['modern'], accent: ['#abcdef'] })).toBe(
      serializeWebsiteEditorSnapshot({ accent: ['#abcdef'], theme: ['modern'] }),
    );
  });

  it('drops redo entries after a new edit and enforces the history limit', () => {
    const first = { title: ['First'] };
    const second = { title: ['Second'] };
    const abandoned = { title: ['Abandoned'] };
    const replacement = { title: ['Replacement'] };
    const final = { title: ['Final'] };

    const history = appendWebsiteEditorSnapshot(
      { entries: [first, second, abandoned], index: 1 },
      replacement,
      3,
    );

    expect(history).toEqual({ entries: [first, second, replacement], index: 2 });
    expect(appendWebsiteEditorSnapshot(history, replacement)).toBe(history);
    expect(appendWebsiteEditorSnapshot(history, final, 3)).toEqual({
      entries: [second, replacement, final],
      index: 2,
    });
  });
});
