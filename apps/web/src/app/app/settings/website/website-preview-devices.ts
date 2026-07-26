export type WebsitePreviewDevice = 'desktop' | 'tablet' | 'mobile';

export const websitePreviewDevices: Array<{
  key: WebsitePreviewDevice;
  label: string;
  width: number;
  height: number;
}> = [
  { key: 'desktop', label: 'Desktop', width: 1280, height: 720 },
  { key: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { key: 'mobile', label: 'Mobile', width: 390, height: 844 },
];

export function calculateWebsitePreviewScale(availableWidth: number, viewportWidth: number) {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(viewportWidth) || viewportWidth <= 0)
    return 1;
  return Math.min(1, Math.max(0.1, availableWidth / viewportWidth));
}
