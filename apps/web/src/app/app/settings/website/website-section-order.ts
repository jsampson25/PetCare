import type { WebsiteLayoutSection, WebsiteLayoutSectionId } from './website-live-preview';

export type WebsiteSectionDropEdge = 'before' | 'after';

export function reorderWebsiteSections(
  sections: WebsiteLayoutSection[],
  activeId: WebsiteLayoutSectionId,
  targetId: WebsiteLayoutSectionId,
  edge: WebsiteSectionDropEdge,
) {
  if (activeId === targetId) return sections;
  const active = sections.find((section) => section.id === activeId);
  if (!active || !sections.some((section) => section.id === targetId)) return sections;

  const remaining = sections.filter((section) => section.id !== activeId);
  const targetIndex = remaining.findIndex((section) => section.id === targetId);
  const insertionIndex = targetIndex + (edge === 'after' ? 1 : 0);
  const next = [...remaining];
  next.splice(insertionIndex, 0, active);
  return next.every((section, index) => section.id === sections[index]?.id) ? sections : next;
}

export function moveWebsiteSection(
  sections: WebsiteLayoutSection[],
  activeId: WebsiteLayoutSectionId,
  direction: -1 | 1,
) {
  const activeIndex = sections.findIndex((section) => section.id === activeId);
  const targetIndex = activeIndex + direction;
  if (activeIndex < 0 || targetIndex < 0 || targetIndex >= sections.length) return sections;

  const next = [...sections];
  [next[activeIndex], next[targetIndex]] = [next[targetIndex], next[activeIndex]];
  return next;
}
