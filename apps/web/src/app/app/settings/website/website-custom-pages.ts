export type WebsiteCustomPage = {
  id: string;
  title: string;
  slug: string;
  body: string;
  showInNavigation: boolean;
};

export const maxWebsiteCustomPages = 10;
export const maxWebsiteNavigationPages = 4;
export const reservedWebsitePageSlugs = new Set([
  'home',
  'about',
  'book',
  'contact',
  'faq',
  'portal',
  'privacy',
  'services',
  'terms',
]);

export function normalizeWebsitePageSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

export function slugifyWebsitePageTitle(value: string) {
  return normalizeWebsitePageSlugInput(value).replace(/^-+|-+$/g, '');
}

export function createUniqueWebsitePageSlug(title: string, pages: WebsiteCustomPage[]) {
  const base = slugifyWebsitePageTitle(title) || 'new-page';
  let candidate = base;
  let suffix = 2;
  const existing = new Set(pages.map((page) => page.slug));
  while (existing.has(candidate) || reservedWebsitePageSlugs.has(candidate)) {
    candidate = `${base.slice(0, 56)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function isWebsiteCustomPageList(value: unknown): value is WebsiteCustomPage[] {
  if (!Array.isArray(value) || value.length > maxWebsiteCustomPages) return false;
  const ids = new Set<string>();
  const slugs = new Set<string>();
  let navigationCount = 0;
  for (const page of value) {
    if (!page || typeof page !== 'object') return false;
    const candidate = page as Partial<WebsiteCustomPage>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.slug !== 'string' ||
      typeof candidate.body !== 'string' ||
      typeof candidate.showInNavigation !== 'boolean' ||
      ids.has(candidate.id) ||
      slugs.has(candidate.slug)
    )
      return false;
    ids.add(candidate.id);
    slugs.add(candidate.slug);
    if (candidate.showInNavigation) navigationCount += 1;
  }
  return navigationCount <= maxWebsiteNavigationPages;
}
