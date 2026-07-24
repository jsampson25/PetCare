'use client';

import { useState } from 'react';

type StyleKey = 'modern' | 'warm' | 'classic';
type Template = {
  key: string;
  name: string;
  description: string;
  layout: 'split' | 'centered' | 'editorial';
};

const stylePalette: Record<
  StyleKey,
  { accent: string; canvas: string; ink: string; soft: string }
> = {
  modern: { accent: '#2563eb', canvas: '#f5f9ff', ink: '#0b1f3a', soft: '#dbeafe' },
  warm: { accent: '#f97316', canvas: '#fff8ed', ink: '#422006', soft: '#fde68a' },
  classic: { accent: '#1f513f', canvas: '#f8f5ee', ink: '#263b31', soft: '#e8dfce' },
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
      <legend className="text-base font-black text-[#0b1f3a]">Choose your website style</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Style sets the personality. The template below controls composition and navigation. Your
        content stays intact when either changes.
      </p>
      <input name="theme" type="hidden" value={style} />
      <input name="template" type="hidden" value={selectedTemplate} />
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {styles.map((option) => (
          <button
            aria-pressed={style === option.key}
            className={`relative rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${style === option.key ? 'border-blue-600 ring-2 ring-blue-600/15' : 'border-slate-200 hover:border-slate-300'}`}
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
            {style === option.key ? (
              <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-9 flex items-end justify-between gap-4 border-t border-slate-200 pt-7">
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
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {availableTemplates.map((template) => (
          <button
            aria-pressed={selectedTemplate === template.key}
            className={`group relative overflow-hidden rounded-[1.35rem] border bg-white p-2.5 text-left transition hover:-translate-y-1 hover:shadow-xl ${selectedTemplate === template.key ? 'border-blue-600 ring-2 ring-blue-600/15' : 'border-slate-200 hover:border-slate-300'}`}
            key={template.key}
            onClick={() => setTemplateByStyle((current) => ({ ...current, [style]: template.key }))}
            type="button"
          >
            <TemplatePreview layout={template.layout} styleKey={style} />
            <span className="block px-2 pb-2 pt-3">
              <span className="flex items-center justify-between gap-3">
                <span className="font-black text-[#0b1f3a]">{template.name}</span>
                {selectedTemplate === template.key ? (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-blue-700">
                    Selected
                  </span>
                ) : (
                  <span className="text-xs font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">
                    Select
                  </span>
                )}
              </span>
              <span className="mt-1.5 block min-h-10 text-sm leading-5 text-[var(--text-secondary)]">
                {template.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TemplatePreview({ layout, styleKey }: { layout: Template['layout']; styleKey: StyleKey }) {
  const palette = stylePalette[styleKey];
  const radius =
    styleKey === 'warm' ? 'rounded-2xl' : styleKey === 'classic' ? 'rounded-sm' : 'rounded-lg';
  return (
    <span
      className={`block aspect-[1.28] overflow-hidden border border-black/5 ${radius}`}
      style={{ backgroundColor: palette.canvas, color: palette.ink }}
    >
      <span className="flex h-[18%] items-center justify-between border-b border-black/5 bg-white/85 px-[6%]">
        <span className="flex items-center gap-1.5">
          <span
            className="grid size-5 place-items-center rounded-md text-[0.45rem] font-black text-white"
            style={{ backgroundColor: palette.accent }}
          >
            P
          </span>
          <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: palette.ink }} />
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1 w-6 rounded-full bg-slate-300" />
          <span className="h-1 w-6 rounded-full bg-slate-300" />
          <span className="h-4 w-9 rounded-full" style={{ backgroundColor: palette.accent }} />
        </span>
      </span>
      <span
        className={`grid h-[57%] gap-[6%] px-[7%] py-[6%] ${
          layout === 'split'
            ? 'grid-cols-[.9fr_1.1fr]'
            : layout === 'editorial'
              ? 'grid-cols-[1.15fr_.85fr]'
              : 'place-items-center text-center'
        }`}
      >
        <span className={layout === 'centered' ? 'grid justify-items-center' : ''}>
          <span
            className="block h-1.5 w-12 rounded-full opacity-60"
            style={{ backgroundColor: palette.accent }}
          />
          <span
            className="mt-2 block h-2.5 w-24 rounded-full"
            style={{ backgroundColor: palette.ink }}
          />
          <span
            className="mt-1.5 block h-2 w-20 rounded-full"
            style={{ backgroundColor: palette.ink }}
          />
          <span className="mt-2 block h-1 w-20 rounded-full bg-slate-300" />
          <span
            className="mt-3 block h-5 w-14 rounded-full"
            style={{ backgroundColor: palette.accent }}
          />
        </span>
        {layout !== 'centered' ? (
          <span
            className={`relative block overflow-hidden ${radius}`}
            style={{ background: `linear-gradient(145deg, ${palette.soft}, white)` }}
          >
            <span className="absolute bottom-0 left-[18%] size-12 rounded-t-full bg-white/80" />
            <span
              className="absolute bottom-4 left-[35%] size-8 rounded-full"
              style={{ backgroundColor: palette.accent, opacity: 0.28 }}
            />
          </span>
        ) : null}
      </span>
      <span className="grid h-[25%] grid-cols-3 gap-[3%] border-t border-black/5 bg-white/55 px-[7%] py-[4%]">
        {[0, 1, 2].map((item) => (
          <span className={`border border-black/5 bg-white ${radius}`} key={item}>
            <span
              className="mx-auto mt-2 block size-2 rounded-full"
              style={{ backgroundColor: palette.accent }}
            />
            <span className="mx-auto mt-1.5 block h-1 w-8 rounded-full bg-slate-300" />
          </span>
        ))}
      </span>
    </span>
  );
}
