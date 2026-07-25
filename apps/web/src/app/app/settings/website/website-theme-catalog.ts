export type WebsiteStyleKey = 'modern' | 'warm' | 'classic';
export type WebsiteTemplateLayout = 'split' | 'centered' | 'editorial';

export type WebsiteTemplate = {
  key: string;
  name: string;
  description: string;
  layout: WebsiteTemplateLayout;
  bestFor: string;
  attributes: string[];
  includedSections: string[];
};

export type WebsiteStyle = {
  key: WebsiteStyleKey;
  name: string;
  description: string;
  swatches: string[];
  palette: { accent: string; canvas: string; ink: string; soft: string };
  templates: WebsiteTemplate[];
};

export const websiteStyles: WebsiteStyle[] = [
  {
    key: 'modern',
    name: 'Modern',
    description: 'Clean spacing, polished typography, and refined visual rhythm.',
    swatches: ['#2563eb', '#dbeafe', '#0b1f3a'],
    palette: { accent: '#2563eb', canvas: '#f5f9ff', ink: '#0b1f3a', soft: '#dbeafe' },
    templates: [
      {
        key: 'studio-split',
        name: 'Studio Split',
        description: 'Statement copy beside a large editorial photo.',
        layout: 'split',
        bestFor: 'Modern resorts and multi-service facilities',
        attributes: ['Editorial', 'Image-forward', 'High contrast'],
        includedSections: ['Split hero', 'Service cards', 'About', 'FAQ', 'Contact'],
      },
      {
        key: 'centered-studio',
        name: 'Centered Studio',
        description: 'Centered brand and hero with an elevated visual frame.',
        layout: 'centered',
        bestFor: 'Premium boarding and boutique grooming',
        attributes: ['Centered logo', 'Calm', 'Premium'],
        includedSections: ['Centered hero', 'Service cards', 'About', 'FAQ', 'Contact'],
      },
      {
        key: 'modern-editorial',
        name: 'Modern Editorial',
        description: 'Asymmetric content for a premium local brand.',
        layout: 'editorial',
        bestFor: 'Businesses with strong photography and storytelling',
        attributes: ['Asymmetric', 'Story-led', 'Spacious'],
        includedSections: ['Editorial hero', 'Services', 'About feature', 'FAQ', 'Contact'],
      },
    ],
  },
  {
    key: 'warm',
    name: 'Playful',
    description: 'Friendly shapes, energetic color, and expressive pet-focused details.',
    swatches: ['#f97316', '#fde68a', '#0f766e'],
    palette: { accent: '#f97316', canvas: '#fff8ed', ink: '#422006', soft: '#fde68a' },
    templates: [
      {
        key: 'happy-tails',
        name: 'Happy Tails',
        description: 'Rounded sections with bold photography and upbeat details.',
        layout: 'split',
        bestFor: 'Daycare and family-focused facilities',
        attributes: ['Friendly', 'Colorful', 'Energetic'],
        includedSections: ['Playful hero', 'Services', 'About', 'FAQ', 'Contact'],
      },
      {
        key: 'pet-parade',
        name: 'Pet Parade',
        description: 'Image-forward storytelling with lively section changes.',
        layout: 'editorial',
        bestFor: 'High-energy daycare and enrichment brands',
        attributes: ['Photo-led', 'Expressive', 'Dynamic'],
        includedSections: ['Editorial hero', 'Service parade', 'About', 'FAQ', 'Contact'],
      },
      {
        key: 'neighborhood',
        name: 'Neighborhood',
        description: 'A welcoming layout focused on local people and pets.',
        layout: 'centered',
        bestFor: 'Community-centered independent businesses',
        attributes: ['Welcoming', 'Local', 'Approachable'],
        includedSections: ['Centered hero', 'Services', 'Community story', 'FAQ', 'Contact'],
      },
    ],
  },
  {
    key: 'classic',
    name: 'Classic',
    description: 'Familiar structure, balanced sections, and dependable presentation.',
    swatches: ['#1f513f', '#efe6d3', '#7c4a2d'],
    palette: { accent: '#1f513f', canvas: '#f8f5ee', ink: '#263b31', soft: '#e8dfce' },
    templates: [
      {
        key: 'heritage',
        name: 'Heritage',
        description: 'Traditional navigation and an established, trusted tone.',
        layout: 'split',
        bestFor: 'Established boarding kennels and country facilities',
        attributes: ['Traditional', 'Trusted', 'Structured'],
        includedSections: ['Split hero', 'Services', 'History', 'FAQ', 'Contact'],
      },
      {
        key: 'lodge',
        name: 'Lodge',
        description: 'Warm photography and grounded service presentation.',
        layout: 'centered',
        bestFor: 'Pet lodges, resorts, and rural properties',
        attributes: ['Warm', 'Grounded', 'Photo-led'],
        includedSections: ['Centered hero', 'Services', 'Property story', 'FAQ', 'Contact'],
      },
      {
        key: 'professional',
        name: 'Professional',
        description: 'Straightforward navigation and information-rich sections.',
        layout: 'editorial',
        bestFor: 'Multi-service and multi-location operators',
        attributes: ['Direct', 'Detailed', 'Operational'],
        includedSections: ['Editorial hero', 'Services', 'Credentials', 'FAQ', 'Contact'],
      },
    ],
  },
];

export function findWebsiteStyle(styleKey: string | undefined) {
  return websiteStyles.find((style) => style.key === styleKey);
}

export function findWebsiteTemplate(templateKey: string | undefined) {
  for (const style of websiteStyles) {
    const template = style.templates.find((item) => item.key === templateKey);
    if (template) return { style, template };
  }
  return undefined;
}

export function resolveWebsiteThemeSelection(
  requestedStyle: string | undefined,
  requestedTemplate: string | undefined,
  fallbackStyle: WebsiteStyleKey,
  fallbackTemplate: string,
) {
  const requested = findWebsiteTemplate(requestedTemplate);
  if (requested && requested.style.key === requestedStyle) {
    return { style: requested.style, template: requested.template, isTrial: true };
  }

  const fallback = findWebsiteTemplate(fallbackTemplate);
  if (fallback && fallback.style.key === fallbackStyle) {
    return { style: fallback.style, template: fallback.template, isTrial: false };
  }

  const style = findWebsiteStyle(fallbackStyle) ?? websiteStyles[0];
  return { style, template: style.templates[0], isTrial: false };
}
