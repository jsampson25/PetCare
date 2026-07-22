'use client';

import { useState } from 'react';

type StyleKey = 'modern' | 'warm' | 'classic';
type Template = {
  key: string;
  name: string;
  description: string;
  layout: 'split' | 'centered' | 'editorial';
};

const styles: Array<{ key: StyleKey; name: string; description: string; swatches: string[] }> = [
  {
    key: 'modern',
    name: 'Modern',
    description: 'Clean spacing, polished typography, and refined visual rhythm.',
    swatches: ['#2563eb', '#dbeafe', '#0b1f3a'],
  },
  {
    key: 'warm',
    name: 'Playful',
    description: 'Friendly shapes, energetic color, and expressive pet-focused details.',
    swatches: ['#f97316', '#fde68a', '#0f766e'],
  },
  {
    key: 'classic',
    name: 'Classic',
    description: 'Familiar structure, balanced sections, and dependable presentation.',
    swatches: ['#1f513f', '#efe6d3', '#7c4a2d'],
  },
];

const templates: Record<StyleKey, Template[]> = {
  modern: [
    {
      key: 'studio-split',
      name: 'Studio split',
      description: 'Statement copy beside a large editorial photo.',
      layout: 'split',
    },
    {
      key: 'centered-studio',
      name: 'Centered studio',
      description: 'Centered brand and hero with an elevated visual frame.',
      layout: 'centered',
    },
    {
      key: 'modern-editorial',
      name: 'Modern editorial',
      description: 'Asymmetric content for a premium local brand.',
      layout: 'editorial',
    },
  ],
  warm: [
    {
      key: 'happy-tails',
      name: 'Happy Tails',
      description: 'Rounded sections with bold photography and upbeat details.',
      layout: 'split',
    },
    {
      key: 'pet-parade',
      name: 'Pet Parade',
      description: 'Image-forward storytelling with lively section changes.',
      layout: 'editorial',
    },
    {
      key: 'neighborhood',
      name: 'Neighborhood',
      description: 'Welcoming local-business layout focused on people and pets.',
      layout: 'centered',
    },
  ],
  classic: [
    {
      key: 'heritage',
      name: 'Heritage',
      description: 'Traditional left navigation and an established, trusted tone.',
      layout: 'split',
    },
    {
      key: 'lodge',
      name: 'Lodge',
      description: 'Warm photography and grounded service presentation.',
      layout: 'centered',
    },
    {
      key: 'professional',
      name: 'Professional',
      description: 'Straightforward navigation and information-rich sections.',
      layout: 'editorial',
    },
  ],
};

export function WebsiteStylePicker({
  initialStyle,
  initialTemplate,
}: {
  initialStyle: StyleKey;
  initialTemplate: string;
}) {
  const [style, setStyle] = useState(initialStyle);
  const availableTemplates = templates[style];
  const [templateByStyle, setTemplateByStyle] = useState<Record<StyleKey, string>>({
    modern: initialStyle === 'modern' ? initialTemplate : templates.modern[0].key,
    warm: initialStyle === 'warm' ? initialTemplate : templates.warm[0].key,
    classic: initialStyle === 'classic' ? initialTemplate : templates.classic[0].key,
  });
  const selectedTemplate = templateByStyle[style];

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-black">Choose a visual style</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Style sets the personality. The template below controls composition and navigation. Your
        content stays intact when either changes.
      </p>
      <input name="theme" type="hidden" value={style} />
      <input name="template" type="hidden" value={selectedTemplate} />
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {styles.map((option) => (
          <button
            aria-pressed={style === option.key}
            className={`rounded-2xl border bg-white p-4 text-left transition ${style === option.key ? 'border-[var(--action-primary)] ring-2 ring-[var(--action-primary)]/15' : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'}`}
            key={option.key}
            onClick={() => setStyle(option.key)}
            type="button"
          >
            <span className="flex gap-2">
              {option.swatches.map((swatch) => (
                <span
                  className="size-7 rounded-full border border-black/5"
                  key={swatch}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </span>
            <span className="mt-4 block text-lg font-black">{option.name}</span>
            <span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black">
            Choose a {styles.find((item) => item.key === style)?.name.toLowerCase()} template
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Three starting compositions are included in each style family.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-bold">
          Content-safe switching
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {availableTemplates.map((template) => (
          <button
            aria-pressed={selectedTemplate === template.key}
            className={`overflow-hidden rounded-2xl border bg-white p-3 text-left transition ${selectedTemplate === template.key ? 'border-[var(--action-primary)] ring-2 ring-[var(--action-primary)]/15' : 'border-[var(--border-default)]'}`}
            key={template.key}
            onClick={() => setTemplateByStyle((current) => ({ ...current, [style]: template.key }))}
            type="button"
          >
            <TemplatePreview layout={template.layout} styleKey={style} />
            <span className="mt-3 block font-black">{template.name}</span>
            <span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">
              {template.description}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TemplatePreview({ layout, styleKey }: { layout: Template['layout']; styleKey: StyleKey }) {
  const radius =
    styleKey === 'warm'
      ? 'rounded-[1.25rem]'
      : styleKey === 'classic'
        ? 'rounded-sm'
        : 'rounded-xl';
  return (
    <span className={`block overflow-hidden border border-black/5 bg-[#f8fafc] ${radius}`}>
      <span className="flex h-9 items-center justify-between border-b bg-white px-3">
        <span className="size-4 rounded bg-[var(--action-primary)]" />
        <span className="flex gap-1">
          <span className="h-1 w-5 bg-slate-200" />
          <span className="h-1 w-5 bg-slate-200" />
        </span>
      </span>
      <span
        className={`grid min-h-28 gap-3 p-4 ${layout === 'split' ? 'grid-cols-2' : layout === 'editorial' ? 'grid-cols-[.8fr_1.2fr]' : 'place-items-center text-center'}`}
      >
        <span>
          <span className="block h-2 w-20 rounded bg-slate-700" />
          <span className="mt-2 block h-1.5 w-16 rounded bg-slate-200" />
          <span className="mt-3 block h-5 w-12 rounded bg-[var(--action-primary)]" />
        </span>
        {layout !== 'centered' ? (
          <span className={`block min-h-20 bg-[var(--surface-subtle)] ${radius}`} />
        ) : null}
      </span>
    </span>
  );
}
