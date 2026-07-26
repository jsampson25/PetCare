import { describe, expect, it } from 'vitest';
import { calculateWebsitePreviewScale, websitePreviewDevices } from './website-preview-devices';

describe('website preview devices', () => {
  it('defines real responsive viewport dimensions', () => {
    expect(websitePreviewDevices.map(({ key, width, height }) => ({ key, width, height }))).toEqual(
      [
        { key: 'desktop', width: 1280, height: 720 },
        { key: 'tablet', width: 768, height: 1024 },
        { key: 'mobile', width: 390, height: 844 },
      ],
    );
  });

  it('scales wide viewports down but never enlarges them', () => {
    expect(calculateWebsitePreviewScale(640, 1280)).toBe(0.5);
    expect(calculateWebsitePreviewScale(800, 390)).toBe(1);
    expect(calculateWebsitePreviewScale(0, 1280)).toBe(0.1);
  });
});
