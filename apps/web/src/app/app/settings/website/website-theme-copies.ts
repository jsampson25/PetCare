import type { WebsiteEditorSnapshot } from './website-editor-history';
import { defaultWebsiteSectionLayout } from './website-section-catalog';
import {
  findWebsiteTemplate,
  type WebsiteStyle,
  type WebsiteTemplate,
} from './website-theme-catalog';

export const maxWebsiteThemeCopies = 5;

export const websiteThemeDesignFields = [
  'theme',
  'template',
  'primary',
  'accent',
  'logoMediaId',
  'heroMediaId',
  'servicesMediaId',
  'aboutMediaId',
  'heroFocalX',
  'heroFocalY',
  'servicesFocalX',
  'servicesFocalY',
  'aboutFocalX',
  'aboutFocalY',
  'sectionLayout',
] as const;

export type WebsiteThemeCopy = {
  id: string;
  name: string;
  theme: string;
  template: string;
  createdAt: string;
  values: WebsiteEditorSnapshot;
};

export function createWebsiteThemeCopy({
  id,
  name,
  now,
  snapshot,
}: {
  id: string;
  name: string;
  now: string;
  snapshot: WebsiteEditorSnapshot;
}): WebsiteThemeCopy {
  const values = Object.fromEntries(
    websiteThemeDesignFields.map((field) => [field, [...(snapshot[field] ?? [''])]]),
  );
  return {
    id,
    name: name.trim().slice(0, 80),
    theme: values.theme?.[0] ?? '',
    template: values.template?.[0] ?? '',
    createdAt: now,
    values,
  };
}

export function createTemplateResetSnapshot(
  snapshot: WebsiteEditorSnapshot,
  style: WebsiteStyle,
  template: WebsiteTemplate,
): WebsiteEditorSnapshot {
  return {
    ...snapshot,
    theme: [style.key],
    template: [template.key],
    primary: [style.swatches[0] ?? style.palette.accent],
    accent: [style.palette.soft],
    logoMediaId: [''],
    heroMediaId: [''],
    servicesMediaId: [''],
    aboutMediaId: [''],
    heroFocalX: ['50'],
    heroFocalY: ['50'],
    servicesFocalX: ['50'],
    servicesFocalY: ['50'],
    aboutFocalX: ['50'],
    aboutFocalY: ['50'],
    sectionLayout: [JSON.stringify(defaultWebsiteSectionLayout)],
  } satisfies WebsiteEditorSnapshot;
}

export function isWebsiteThemeCopyList(value: unknown): value is WebsiteThemeCopy[] {
  if (!Array.isArray(value) || value.length > maxWebsiteThemeCopies) return false;
  const ids = new Set<string>();
  return value.every((copy) => {
    if (!copy || typeof copy !== 'object') return false;
    const candidate = copy as Partial<WebsiteThemeCopy>;
    if (
      typeof candidate.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        candidate.id,
      ) ||
      typeof candidate.name !== 'string' ||
      candidate.name.length < 1 ||
      candidate.name.length > 80 ||
      typeof candidate.theme !== 'string' ||
      typeof candidate.template !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      candidate.createdAt.length > 40 ||
      !candidate.values ||
      typeof candidate.values !== 'object' ||
      Array.isArray(candidate.values) ||
      ids.has(candidate.id)
    )
      return false;
    ids.add(candidate.id);
    const keys = Object.keys(candidate.values);
    const selection = findWebsiteTemplate(candidate.template);
    return (
      selection?.style.key === candidate.theme &&
      keys.length === websiteThemeDesignFields.length &&
      keys.every((key) => websiteThemeDesignFields.includes(key as never)) &&
      keys.every((key) =>
        candidate.values
          ? Array.isArray(candidate.values[key]) &&
            candidate.values[key]!.length === 1 &&
            candidate.values[key]!.every((item) => typeof item === 'string' && item.length <= 10000)
          : false,
      )
    );
  });
}
