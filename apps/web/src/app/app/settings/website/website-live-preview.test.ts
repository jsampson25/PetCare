import { describe, expect, it } from 'vitest';
import {
  createWebsiteLivePreviewMessage,
  createWebsitePreviewSectionMessage,
  parseWebsiteLivePreviewMessage,
  parseWebsitePreviewSectionMessage,
  WEBSITE_PREVIEW_MESSAGE_TYPE,
} from './website-live-preview';

describe('website live preview messages', () => {
  it('creates an approved preview payload from website form data', () => {
    const formData = new FormData();
    formData.set('heroTitle', 'A better stay starts here');
    formData.set('heroBody', 'Personalized care for every guest.');
    formData.set('about', 'Family owned and locally operated.');
    formData.set('contactEmail', 'hello@example.com');
    formData.set('contactPhone', '555-0100');
    formData.set('faqQuestion', 'What should I bring?');
    formData.set('faqAnswer', 'Bring food and medication.');
    formData.set('policies', 'Vaccinations are required.');
    formData.set('primary', '#123456');
    formData.set('accent', '#abcdef');
    formData.set(
      'sectionLayout',
      JSON.stringify([
        { id: 'about', visible: true },
        { id: 'services', visible: false },
        { id: 'faq', visible: true },
        { id: 'contact', visible: true },
      ]),
    );

    expect(createWebsiteLivePreviewMessage(formData)).toEqual({
      type: WEBSITE_PREVIEW_MESSAGE_TYPE,
      payload: {
        about: 'Family owned and locally operated.',
        accent: '#abcdef',
        contactEmail: 'hello@example.com',
        contactPhone: '555-0100',
        faqAnswer: 'Bring food and medication.',
        faqQuestion: 'What should I bring?',
        heroBody: 'Personalized care for every guest.',
        heroTitle: 'A better stay starts here',
        policies: 'Vaccinations are required.',
        primary: '#123456',
        sectionLayout: [
          { id: 'about', visible: true },
          { id: 'services', visible: false },
          { id: 'faq', visible: true },
          { id: 'contact', visible: true },
        ],
      },
    });
  });

  it('rejects malformed messages and invalid colors', () => {
    expect(parseWebsiteLivePreviewMessage({ type: 'unknown', payload: {} })).toBeNull();
    const valid = createWebsiteLivePreviewMessage(new FormData());
    expect(
      parseWebsiteLivePreviewMessage({
        ...valid,
        payload: { ...valid.payload, primary: 'red' },
      }),
    ).toBeNull();

    expect(
      parseWebsiteLivePreviewMessage({
        ...valid,
        payload: {
          ...valid.payload,
          sectionLayout: [
            { id: 'services', visible: true },
            { id: 'services', visible: false },
            { id: 'faq', visible: true },
            { id: 'contact', visible: true },
          ],
        },
      }),
    ).toBeNull();
  });

  it('accepts only approved preview section selections', () => {
    expect(parseWebsitePreviewSectionMessage(createWebsitePreviewSectionMessage('about'))).toEqual(
      createWebsitePreviewSectionMessage('about'),
    );
    expect(
      parseWebsitePreviewSectionMessage({
        type: 'petcare.website-preview.section',
        payload: { section: 'billing' },
      }),
    ).toBeNull();
  });
});
