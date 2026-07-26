import { describe, expect, it } from 'vitest';
import {
  createUniqueWebsitePageSlug,
  isWebsiteCustomPageList,
  slugifyWebsitePageTitle,
  type WebsiteCustomPage,
} from './website-custom-pages';

const page = (slug: string, showInNavigation = false): WebsiteCustomPage => ({
  id: crypto.randomUUID(),
  title: 'Page title',
  slug,
  body: 'Page body',
  showInNavigation,
});

describe('website custom pages', () => {
  it('creates normalized, unique, non-reserved page addresses', () => {
    expect(slugifyWebsitePageTitle(' First Visit & FAQs ')).toBe('first-visit-faqs');
    expect(createUniqueWebsitePageSlug('New page', [page('new-page'), page('new-page-2')])).toBe(
      'new-page-3',
    );
    expect(createUniqueWebsitePageSlug('Contact', [])).toBe('contact-2');
  });

  it('validates uniqueness and the navigation limit', () => {
    expect(isWebsiteCustomPageList([page('one'), page('two')])).toBe(true);
    expect(isWebsiteCustomPageList([page('same'), page('same')])).toBe(false);
    expect(
      isWebsiteCustomPageList([
        page('one', true),
        page('two', true),
        page('three', true),
        page('four', true),
        page('five', true),
      ]),
    ).toBe(false);
  });
});
