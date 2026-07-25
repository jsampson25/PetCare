import { describe, expect, it } from 'vitest';
import {
  findWebsiteTemplate,
  resolveWebsiteThemeSelection,
  websiteStyles,
} from './website-theme-catalog';

describe('website theme catalog', () => {
  it('contains three distinct families with three templates each', () => {
    expect(websiteStyles.map((style) => style.key)).toEqual(['modern', 'warm', 'classic']);
    expect(websiteStyles.every((style) => style.templates.length === 3)).toBe(true);
  });

  it('loads a valid requested template as an unsaved trial', () => {
    const selection = resolveWebsiteThemeSelection('warm', 'happy-tails', 'modern', 'studio-split');

    expect(selection.style.key).toBe('warm');
    expect(selection.template.key).toBe('happy-tails');
    expect(selection.isTrial).toBe(true);
  });

  it('does not accept a template from a different requested family', () => {
    const selection = resolveWebsiteThemeSelection(
      'classic',
      'happy-tails',
      'modern',
      'studio-split',
    );

    expect(selection.style.key).toBe('modern');
    expect(selection.template.key).toBe('studio-split');
    expect(selection.isTrial).toBe(false);
  });

  it('falls back to the first template when saved values are invalid', () => {
    const selection = resolveWebsiteThemeSelection(
      undefined,
      undefined,
      'classic',
      'missing-template',
    );

    expect(selection.style.key).toBe('classic');
    expect(selection.template.key).toBe('heritage');
    expect(selection.isTrial).toBe(false);
  });

  it('finds templates together with their owning family', () => {
    const result = findWebsiteTemplate('professional');

    expect(result?.style.key).toBe('classic');
    expect(result?.template.name).toBe('Professional');
  });
});
