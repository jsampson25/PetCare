import { describe, expect, it } from 'vitest';
import type { WebsiteLayoutSection } from './website-live-preview';
import { moveWebsiteSection, reorderWebsiteSections } from './website-section-order';

const sections: WebsiteLayoutSection[] = [
  { id: 'services', visible: true },
  { id: 'about', visible: true },
  { id: 'faq', visible: true },
  { id: 'contact', visible: true },
];

describe('website section ordering', () => {
  it('places a dragged section before or after the target', () => {
    expect(
      reorderWebsiteSections(sections, 'contact', 'about', 'before').map(({ id }) => id),
    ).toEqual(['services', 'contact', 'about', 'faq']);
    expect(
      reorderWebsiteSections(sections, 'services', 'faq', 'after').map(({ id }) => id),
    ).toEqual(['about', 'faq', 'services', 'contact']);
  });

  it('moves a section by one position for keyboard controls', () => {
    expect(moveWebsiteSection(sections, 'about', -1).map(({ id }) => id)).toEqual([
      'about',
      'services',
      'faq',
      'contact',
    ]);
    expect(moveWebsiteSection(sections, 'faq', 1).map(({ id }) => id)).toEqual([
      'services',
      'about',
      'contact',
      'faq',
    ]);
  });

  it('preserves the same array for invalid or unavailable moves', () => {
    expect(moveWebsiteSection(sections, 'services', -1)).toBe(sections);
    expect(reorderWebsiteSections(sections, 'about', 'about', 'before')).toBe(sections);
    expect(reorderWebsiteSections(sections, 'services', 'about', 'before')).toBe(sections);
  });
});
