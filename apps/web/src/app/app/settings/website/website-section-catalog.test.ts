import { describe, expect, it } from 'vitest';
import {
  addWebsiteSection,
  defaultWebsiteSectionLayout,
  isWebsiteSectionLayout,
  removeWebsiteSection,
} from './website-section-catalog';

describe('website section catalog', () => {
  it('accepts core sections with unique approved optional blocks', () => {
    expect(
      isWebsiteSectionLayout([
        ...defaultWebsiteSectionLayout,
        { id: 'highlights', visible: true },
        { id: 'cta', visible: false },
      ]),
    ).toBe(true);
  });

  it('rejects missing core, duplicate, and unapproved blocks', () => {
    expect(isWebsiteSectionLayout(defaultWebsiteSectionLayout.slice(1))).toBe(false);
    expect(
      isWebsiteSectionLayout([...defaultWebsiteSectionLayout, { id: 'services', visible: true }]),
    ).toBe(false);
    expect(
      isWebsiteSectionLayout([...defaultWebsiteSectionLayout, { id: 'script', visible: true }]),
    ).toBe(false);
  });

  it('adds and removes optional blocks without changing required sections', () => {
    const added = addWebsiteSection(defaultWebsiteSectionLayout, 'process');
    expect(added.at(-1)).toEqual({ id: 'process', visible: true });
    expect(addWebsiteSection(added, 'process')).toBe(added);
    expect(removeWebsiteSection(added, 'process')).toEqual(defaultWebsiteSectionLayout);
    expect(removeWebsiteSection(defaultWebsiteSectionLayout, 'services')).toBe(
      defaultWebsiteSectionLayout,
    );
  });
});
