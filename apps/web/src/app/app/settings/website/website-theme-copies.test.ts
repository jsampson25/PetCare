import { describe, expect, it } from 'vitest';
import { createWebsiteEditorSnapshot } from './website-editor-history';
import {
  createTemplateResetSnapshot,
  createWebsiteThemeCopy,
  isWebsiteThemeCopyList,
} from './website-theme-copies';
import { websiteStyles } from './website-theme-catalog';

describe('website theme copies', () => {
  it('copies only design fields', () => {
    const form = new FormData();
    form.set('theme', 'modern');
    form.set('template', 'studio-split');
    form.set('primary', '#123456');
    form.set('heroTitle', 'Keep this content outside the copy');
    const copy = createWebsiteThemeCopy({
      id: '123e4567-e89b-42d3-a456-426614174000',
      name: '  Spring option  ',
      now: '2026-07-26T12:00:00.000Z',
      snapshot: createWebsiteEditorSnapshot(form),
    });
    expect(copy.name).toBe('Spring option');
    expect(copy.values.primary).toEqual(['#123456']);
    expect(copy.values.heroTitle).toBeUndefined();
    expect(isWebsiteThemeCopyList([copy])).toBe(true);
  });

  it('resets design fields while preserving business content', () => {
    const style = websiteStyles[0]!;
    const template = style.templates[0]!;
    const reset = createTemplateResetSnapshot(
      { heroTitle: ['Welcome to our business'], primary: ['#123456'] },
      style,
      template,
    );
    expect(reset.heroTitle).toEqual(['Welcome to our business']);
    expect(reset.primary).toEqual([style.swatches[0]]);
    expect(reset.heroMediaId).toEqual(['']);
  });
});
