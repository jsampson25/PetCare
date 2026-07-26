export const websiteCoreSectionIds = ['services', 'about', 'faq', 'contact'] as const;
export const websiteOptionalSectionIds = ['highlights', 'process', 'cta'] as const;
export const websiteSectionIds = [...websiteCoreSectionIds, ...websiteOptionalSectionIds] as const;

export type WebsiteLayoutSectionId = (typeof websiteSectionIds)[number];
export type WebsiteLayoutSection = { id: WebsiteLayoutSectionId; visible: boolean };

export const websiteSectionCatalog: Record<
  WebsiteLayoutSectionId,
  { name: string; description: string; optional: boolean }
> = {
  services: {
    name: 'Services',
    description: 'Boarding, daycare, grooming, and other published services.',
    optional: false,
  },
  about: {
    name: 'About and trust',
    description: 'Your story, care philosophy, and reasons families choose you.',
    optional: false,
  },
  faq: {
    name: 'Frequently asked questions',
    description: 'Answers that help customers prepare before booking.',
    optional: false,
  },
  contact: {
    name: 'Contact and policies',
    description: 'Locations, contact form, hours, and policy information.',
    optional: false,
  },
  highlights: {
    name: 'Care highlights',
    description: 'Three concise reasons customers can trust your care experience.',
    optional: true,
  },
  process: {
    name: 'How it works',
    description: 'A simple three-step path from pet profile to a completed visit.',
    optional: true,
  },
  cta: {
    name: 'Booking call to action',
    description: 'A focused invitation that sends customers into online booking.',
    optional: true,
  },
};

export const defaultWebsiteSectionLayout: WebsiteLayoutSection[] = websiteCoreSectionIds.map(
  (id) => ({ id, visible: true }),
);

export function isWebsiteLayoutSectionId(value: unknown): value is WebsiteLayoutSectionId {
  return typeof value === 'string' && websiteSectionIds.includes(value as WebsiteLayoutSectionId);
}

export function isWebsiteSectionLayout(value: unknown): value is WebsiteLayoutSection[] {
  if (!Array.isArray(value) || value.length < 4 || value.length > websiteSectionIds.length)
    return false;
  const seen = new Set<string>();
  for (const section of value) {
    if (!section || typeof section !== 'object') return false;
    const candidate = section as Partial<WebsiteLayoutSection>;
    if (
      !isWebsiteLayoutSectionId(candidate.id) ||
      typeof candidate.visible !== 'boolean' ||
      seen.has(candidate.id)
    )
      return false;
    seen.add(candidate.id);
  }
  return websiteCoreSectionIds.every((id) => seen.has(id));
}

export function addWebsiteSection(sections: WebsiteLayoutSection[], id: WebsiteLayoutSectionId) {
  if (!websiteOptionalSectionIds.includes(id as (typeof websiteOptionalSectionIds)[number]))
    return sections;
  if (sections.some((section) => section.id === id)) return sections;
  return [...sections, { id, visible: true }];
}

export function removeWebsiteSection(sections: WebsiteLayoutSection[], id: WebsiteLayoutSectionId) {
  if (!websiteOptionalSectionIds.includes(id as (typeof websiteOptionalSectionIds)[number]))
    return sections;
  if (!sections.some((section) => section.id === id)) return sections;
  return sections.filter((section) => section.id !== id);
}
