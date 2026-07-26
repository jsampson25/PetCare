export const WEBSITE_PREVIEW_MESSAGE_TYPE = 'petcare.website-preview.update';
export const WEBSITE_PREVIEW_READY_MESSAGE_TYPE = 'petcare.website-preview.ready';

export type WebsiteLivePreviewDraft = {
  about: string;
  accent: string;
  contactEmail: string;
  contactPhone: string;
  heroBody: string;
  heroTitle: string;
  primary: string;
};

export type WebsiteLivePreviewMessage = {
  type: typeof WEBSITE_PREVIEW_MESSAGE_TYPE;
  payload: WebsiteLivePreviewDraft;
};

const colorPattern = /^#[0-9a-f]{6}$/i;

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function createWebsiteLivePreviewMessage(formData: FormData): WebsiteLivePreviewMessage {
  const primary = stringValue(formData, 'primary');
  const accent = stringValue(formData, 'accent');

  return {
    type: WEBSITE_PREVIEW_MESSAGE_TYPE,
    payload: {
      about: stringValue(formData, 'about'),
      accent: colorPattern.test(accent) ? accent : '#d97745',
      contactEmail: stringValue(formData, 'contactEmail'),
      contactPhone: stringValue(formData, 'contactPhone'),
      heroBody: stringValue(formData, 'heroBody'),
      heroTitle: stringValue(formData, 'heroTitle'),
      primary: colorPattern.test(primary) ? primary : '#23664f',
    },
  };
}

export function parseWebsiteLivePreviewMessage(value: unknown): WebsiteLivePreviewMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WebsiteLivePreviewMessage>;
  if (candidate.type !== WEBSITE_PREVIEW_MESSAGE_TYPE || !candidate.payload) return null;

  const payload = candidate.payload as Partial<WebsiteLivePreviewDraft>;
  const textFields: Array<keyof Omit<WebsiteLivePreviewDraft, 'primary' | 'accent'>> = [
    'about',
    'contactEmail',
    'contactPhone',
    'heroBody',
    'heroTitle',
  ];

  if (textFields.some((field) => typeof payload[field] !== 'string')) return null;
  if (typeof payload.primary !== 'string' || !colorPattern.test(payload.primary)) return null;
  if (typeof payload.accent !== 'string' || !colorPattern.test(payload.accent)) return null;

  return candidate as WebsiteLivePreviewMessage;
}
