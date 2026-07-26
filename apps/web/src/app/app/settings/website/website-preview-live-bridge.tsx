'use client';

import { validateTenantActionColor } from '@petcare/config/tenant-theme';
import { useEffect } from 'react';
import {
  createWebsitePreviewSectionMessage,
  parseWebsiteLivePreviewMessage,
  parseWebsitePreviewSectionMessage,
  WEBSITE_PREVIEW_READY_MESSAGE_TYPE,
  type WebsitePreviewMedia,
  type WebsitePreviewMediaSlot,
  type WebsitePreviewSection,
} from './website-live-preview';

const previewFieldSelectors = {
  about: '[data-preview-field="about"]',
  contactEmail: '[data-preview-field="contactEmail"]',
  contactPhone: '[data-preview-field="contactPhone"]',
  faqAnswer: '[data-preview-field="faqAnswer"]',
  faqQuestion: '[data-preview-field="faqQuestion"]',
  heroBody: '[data-preview-field="heroBody"]',
  heroTitle: '[data-preview-field="heroTitle"]',
  policies: '[data-preview-field="policies"]',
} as const;

const mediaSlots: WebsitePreviewMediaSlot[] = ['logo', 'hero', 'services', 'about'];

function setImageSemantics(element: HTMLElement | null, media: WebsitePreviewMedia | null) {
  if (!element) return;
  if (media) {
    element.setAttribute('aria-label', media.altText);
    element.setAttribute('role', 'img');
  } else {
    element.removeAttribute('aria-label');
    element.removeAttribute('role');
  }
}

function applyPreviewMedia(slot: WebsitePreviewMediaSlot, media: WebsitePreviewMedia | null) {
  const surface = document.querySelector<HTMLElement>(`[data-preview-media="${slot}"]`);
  if (!surface) return;
  const imageUrl = media ? `url(${JSON.stringify(media.url)})` : '';
  const focalPosition = media ? `${media.focalPoint.x}% ${media.focalPoint.y}%` : 'center';

  if (slot === 'logo') {
    surface.style.backgroundColor = media ? 'transparent' : 'var(--tenant-primary)';
    surface.style.backgroundImage = imageUrl;
    surface.style.backgroundPosition = media ? 'center' : '';
    surface.style.backgroundRepeat = media ? 'no-repeat' : '';
    surface.style.backgroundSize = media ? 'contain' : '';
    surface.style.color = media ? 'transparent' : 'var(--action-primary-text)';
    surface.classList.toggle('rounded-2xl', !media);
    surface.classList.toggle('shadow-sm', !media);
    setImageSemantics(surface, media);
    return;
  }

  if (slot === 'services') {
    surface.hidden = !media;
    surface.style.backgroundImage = imageUrl;
    surface.style.backgroundPosition = focalPosition;
    setImageSemantics(surface, media);
    return;
  }

  surface.style.background = media
    ? slot === 'hero'
      ? `linear-gradient(0deg, rgba(0,0,0,.28), rgba(0,0,0,0)), ${imageUrl} ${focalPosition} / cover`
      : `${imageUrl} ${focalPosition} / cover`
    : slot === 'hero'
      ? 'linear-gradient(135deg, color-mix(in srgb, var(--tenant-primary) 12%, white), color-mix(in srgb, var(--tenant-accent) 22%, white))'
      : 'linear-gradient(145deg, color-mix(in srgb, var(--tenant-primary) 75%, #101827), color-mix(in srgb, var(--tenant-accent) 35%, #101827))';
  const container =
    document.querySelector<HTMLElement>(`[data-preview-media-container="${slot}"]`) ?? surface;
  setImageSemantics(container, media);
  const placeholder = document.querySelector<HTMLElement>(
    `[data-preview-media-placeholder="${slot}"]`,
  );
  if (placeholder) placeholder.hidden = Boolean(media);
}

export function WebsitePreviewLiveBridge() {
  useEffect(() => {
    function selectPreviewSection(section: WebsitePreviewSection) {
      document.querySelectorAll<HTMLElement>('[data-preview-section]').forEach((element) => {
        if (element.dataset.previewSection === section) {
          element.dataset.previewSelected = 'true';
        } else {
          delete element.dataset.previewSelected;
        }
      });
    }

    function receivePreviewUpdate(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const sectionMessage = parseWebsitePreviewSectionMessage(event.data);
      if (sectionMessage) {
        selectPreviewSection(sectionMessage.payload.section);
        return;
      }
      const message = parseWebsiteLivePreviewMessage(event.data);
      if (!message) return;

      const root = document.querySelector<HTMLElement>('[data-website-preview-root]');
      if (!root) return;

      const validatedPrimary = validateTenantActionColor(message.payload.primary);
      root.style.setProperty('--tenant-primary', message.payload.primary);
      root.style.setProperty('--tenant-accent', message.payload.accent);
      root.style.setProperty('--action-primary', message.payload.primary);
      root.style.setProperty(
        '--action-primary-text',
        validatedPrimary.accepted ? validatedPrimary.actionTextColor : '#ffffff',
      );

      for (const [field, selector] of Object.entries(previewFieldSelectors)) {
        const value = message.payload[field as keyof typeof previewFieldSelectors];
        document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
          element.textContent = value;
        });
      }

      const layoutRoot = document.querySelector<HTMLElement>('[data-preview-layout-root]');
      message.payload.sectionLayout.forEach((section, index) => {
        const element = layoutRoot?.querySelector<HTMLElement>(
          `[data-preview-layout-section="${section.id}"]`,
        );
        if (!element) return;
        element.hidden = !section.visible;
        element.style.order = String(index);
      });
      mediaSlots.forEach((slot) => applyPreviewMedia(slot, message.payload.media[slot]));
    }

    function publishSectionSelection(target: EventTarget | null) {
      if (!(target instanceof Element)) return;
      const sectionElement = target.closest<HTMLElement>('[data-preview-section]');
      const section = sectionElement?.dataset.previewSection as WebsitePreviewSection | undefined;
      if (!section) return;
      selectPreviewSection(section);
      window.parent.postMessage(
        createWebsitePreviewSectionMessage(section),
        window.location.origin,
      );
    }

    function handlePreviewClick(event: MouseEvent) {
      publishSectionSelection(event.target);
    }

    function handlePreviewKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!(event.target instanceof Element) || !event.target.matches('[data-preview-section]')) {
        return;
      }
      event.preventDefault();
      publishSectionSelection(event.target);
    }

    window.addEventListener('message', receivePreviewUpdate);
    document.addEventListener('click', handlePreviewClick);
    document.addEventListener('keydown', handlePreviewKeyDown);
    window.parent.postMessage({ type: WEBSITE_PREVIEW_READY_MESSAGE_TYPE }, window.location.origin);
    return () => {
      window.removeEventListener('message', receivePreviewUpdate);
      document.removeEventListener('click', handlePreviewClick);
      document.removeEventListener('keydown', handlePreviewKeyDown);
    };
  }, []);

  return null;
}
