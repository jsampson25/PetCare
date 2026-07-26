'use client';

import { validateTenantActionColor } from '@petcare/config/tenant-theme';
import { useEffect } from 'react';
import {
  createWebsitePreviewSectionMessage,
  parseWebsiteLivePreviewMessage,
  parseWebsitePreviewSectionMessage,
  WEBSITE_PREVIEW_READY_MESSAGE_TYPE,
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
