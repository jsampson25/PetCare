export const WEBSITE_PREVIEW_MESSAGE_TYPE = 'petcare.website-preview.update';
export const WEBSITE_PREVIEW_READY_MESSAGE_TYPE = 'petcare.website-preview.ready';
export const WEBSITE_PREVIEW_SECTION_MESSAGE_TYPE = 'petcare.website-preview.section';
export const WEBSITE_EDITOR_SECTION_EVENT_TYPE = 'petcare:website-editor-section';

export type WebsitePreviewSection = 'hero' | 'services' | 'about' | 'contact';
export type WebsiteLayoutSectionId = 'services' | 'about' | 'faq' | 'contact';
export type WebsiteLayoutSection = { id: WebsiteLayoutSectionId; visible: boolean };
export type WebsitePreviewMediaSlot = 'logo' | 'hero' | 'services' | 'about';
export type WebsitePreviewMedia = { url: string; altText: string };
export type WebsitePreviewMediaCatalogItem = {
  id: string;
  publicUrl: string;
  alt_text: string;
};

export type WebsiteLivePreviewDraft = {
  about: string;
  accent: string;
  contactEmail: string;
  contactPhone: string;
  faqAnswer: string;
  faqQuestion: string;
  heroBody: string;
  heroTitle: string;
  media: Record<WebsitePreviewMediaSlot, WebsitePreviewMedia | null>;
  policies: string;
  primary: string;
  sectionLayout: WebsiteLayoutSection[];
};

export type WebsiteLivePreviewMessage = {
  type: typeof WEBSITE_PREVIEW_MESSAGE_TYPE;
  payload: WebsiteLivePreviewDraft;
};

export type WebsitePreviewSectionMessage = {
  type: typeof WEBSITE_PREVIEW_SECTION_MESSAGE_TYPE;
  payload: { section: WebsitePreviewSection };
};

const colorPattern = /^#[0-9a-f]{6}$/i;
const previewSections: WebsitePreviewSection[] = ['hero', 'services', 'about', 'contact'];
const defaultSectionLayout: WebsiteLayoutSection[] = [
  { id: 'services', visible: true },
  { id: 'about', visible: true },
  { id: 'faq', visible: true },
  { id: 'contact', visible: true },
];
const layoutSectionIds: WebsiteLayoutSectionId[] = ['services', 'about', 'faq', 'contact'];
const mediaSlots: WebsitePreviewMediaSlot[] = ['logo', 'hero', 'services', 'about'];

export function isWebsitePreviewSection(value: unknown): value is WebsitePreviewSection {
  return typeof value === 'string' && previewSections.includes(value as WebsitePreviewSection);
}

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function isWebsiteSectionLayout(value: unknown): value is WebsiteLayoutSection[] {
  if (!Array.isArray(value) || value.length !== layoutSectionIds.length) return false;
  const seen = new Set<string>();
  return value.every((section) => {
    if (!section || typeof section !== 'object') return false;
    const candidate = section as Partial<WebsiteLayoutSection>;
    if (
      !layoutSectionIds.includes(candidate.id as WebsiteLayoutSectionId) ||
      typeof candidate.visible !== 'boolean' ||
      seen.has(String(candidate.id))
    ) {
      return false;
    }
    seen.add(String(candidate.id));
    return true;
  });
}

export function parseWebsiteSectionLayout(value: string): WebsiteLayoutSection[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isWebsiteSectionLayout(parsed) ? parsed : defaultSectionLayout;
  } catch {
    return defaultSectionLayout;
  }
}

function isSafeWebsitePreviewMedia(value: unknown): value is WebsitePreviewMedia | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WebsitePreviewMedia>;
  if (typeof candidate.url !== 'string' || typeof candidate.altText !== 'string') return false;
  try {
    const url = new URL(candidate.url);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && candidate.altText.length <= 500
    );
  } catch {
    return false;
  }
}

function resolveWebsitePreviewMedia(
  formData: FormData,
  mediaCatalog: WebsitePreviewMediaCatalogItem[],
): Record<WebsitePreviewMediaSlot, WebsitePreviewMedia | null> {
  return Object.fromEntries(
    mediaSlots.map((slot) => {
      const selectedId = stringValue(formData, `${slot}MediaId`);
      const selected = mediaCatalog.find((item) => item.id === selectedId);
      const media = selected ? { url: selected.publicUrl, altText: selected.alt_text } : null;
      return [slot, isSafeWebsitePreviewMedia(media) ? media : null];
    }),
  ) as Record<WebsitePreviewMediaSlot, WebsitePreviewMedia | null>;
}

function isWebsitePreviewMediaSelection(
  value: unknown,
): value is Record<WebsitePreviewMediaSlot, WebsitePreviewMedia | null> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Record<WebsitePreviewMediaSlot, unknown>>;
  return mediaSlots.every((slot) => isSafeWebsitePreviewMedia(candidate[slot]));
}

export function createWebsiteLivePreviewMessage(
  formData: FormData,
  mediaCatalog: WebsitePreviewMediaCatalogItem[] = [],
): WebsiteLivePreviewMessage {
  const primary = stringValue(formData, 'primary');
  const accent = stringValue(formData, 'accent');

  return {
    type: WEBSITE_PREVIEW_MESSAGE_TYPE,
    payload: {
      about: stringValue(formData, 'about'),
      accent: colorPattern.test(accent) ? accent : '#d97745',
      contactEmail: stringValue(formData, 'contactEmail'),
      contactPhone: stringValue(formData, 'contactPhone'),
      faqAnswer: stringValue(formData, 'faqAnswer'),
      faqQuestion: stringValue(formData, 'faqQuestion'),
      heroBody: stringValue(formData, 'heroBody'),
      heroTitle: stringValue(formData, 'heroTitle'),
      media: resolveWebsitePreviewMedia(formData, mediaCatalog),
      policies: stringValue(formData, 'policies'),
      primary: colorPattern.test(primary) ? primary : '#23664f',
      sectionLayout: parseWebsiteSectionLayout(stringValue(formData, 'sectionLayout')),
    },
  };
}

export function parseWebsiteLivePreviewMessage(value: unknown): WebsiteLivePreviewMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WebsiteLivePreviewMessage>;
  if (candidate.type !== WEBSITE_PREVIEW_MESSAGE_TYPE || !candidate.payload) return null;

  const payload = candidate.payload as Partial<WebsiteLivePreviewDraft>;
  const textFields: Array<
    keyof Omit<WebsiteLivePreviewDraft, 'primary' | 'accent' | 'media' | 'sectionLayout'>
  > = [
    'about',
    'contactEmail',
    'contactPhone',
    'faqAnswer',
    'faqQuestion',
    'heroBody',
    'heroTitle',
    'policies',
  ];

  if (textFields.some((field) => typeof payload[field] !== 'string')) return null;
  if (typeof payload.primary !== 'string' || !colorPattern.test(payload.primary)) return null;
  if (typeof payload.accent !== 'string' || !colorPattern.test(payload.accent)) return null;
  if (!isWebsitePreviewMediaSelection(payload.media)) return null;
  if (!isWebsiteSectionLayout(payload.sectionLayout)) return null;

  return candidate as WebsiteLivePreviewMessage;
}

export function createWebsitePreviewSectionMessage(
  section: WebsitePreviewSection,
): WebsitePreviewSectionMessage {
  return { type: WEBSITE_PREVIEW_SECTION_MESSAGE_TYPE, payload: { section } };
}

export function parseWebsitePreviewSectionMessage(
  value: unknown,
): WebsitePreviewSectionMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WebsitePreviewSectionMessage>;
  if (candidate.type !== WEBSITE_PREVIEW_SECTION_MESSAGE_TYPE || !candidate.payload) return null;
  const section = (candidate.payload as { section?: unknown }).section;
  return isWebsitePreviewSection(section) ? (candidate as WebsitePreviewSectionMessage) : null;
}
