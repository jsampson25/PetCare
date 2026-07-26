'use client';

import { validateTenantActionColor } from '@petcare/config/tenant-theme';
import { useEffect } from 'react';
import {
  parseWebsiteLivePreviewMessage,
  WEBSITE_PREVIEW_READY_MESSAGE_TYPE,
} from './website-live-preview';

const previewFieldSelectors = {
  about: '[data-preview-field="about"]',
  contactEmail: '[data-preview-field="contactEmail"]',
  contactPhone: '[data-preview-field="contactPhone"]',
  heroBody: '[data-preview-field="heroBody"]',
  heroTitle: '[data-preview-field="heroTitle"]',
} as const;

export function WebsitePreviewLiveBridge() {
  useEffect(() => {
    function receivePreviewUpdate(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
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
    }

    window.addEventListener('message', receivePreviewUpdate);
    window.parent.postMessage({ type: WEBSITE_PREVIEW_READY_MESSAGE_TYPE }, window.location.origin);
    return () => window.removeEventListener('message', receivePreviewUpdate);
  }, []);

  return null;
}
