'use client';

import { useState } from 'react';

export type WebsiteSection = {
  id: 'services' | 'about' | 'faq' | 'contact';
  visible: boolean;
};

const sectionDetails: Record<WebsiteSection['id'], { name: string; description: string }> = {
  services: {
    name: 'Services',
    description: 'Boarding, daycare, grooming, and other published services.',
  },
  about: {
    name: 'About and trust',
    description: 'Your story, care philosophy, and reasons families choose you.',
  },
  faq: {
    name: 'Frequently asked questions',
    description: 'Answers that help customers prepare before booking.',
  },
  contact: {
    name: 'Contact and policies',
    description: 'Locations, contact form, hours, and policy information.',
  },
};

export const defaultWebsiteSections: WebsiteSection[] = [
  { id: 'services', visible: true },
  { id: 'about', visible: true },
  { id: 'faq', visible: true },
  { id: 'contact', visible: true },
];

export function WebsiteSectionEditor({ initialSections }: { initialSections: WebsiteSection[] }) {
  const [sections, setSections] = useState(initialSections);
  const [draggedId, setDraggedId] = useState<WebsiteSection['id'] | null>(null);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropBefore(targetId: WebsiteSection['id']) {
    if (!draggedId || draggedId === targetId) return;
    setSections((current) => {
      const dragged = current.find((section) => section.id === draggedId);
      if (!dragged) return current;
      const withoutDragged = current.filter((section) => section.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((section) => section.id === targetId);
      withoutDragged.splice(targetIndex, 0, dragged);
      return withoutDragged;
    });
    setDraggedId(null);
  }

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-black">Homepage sections</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Drag sections into order, or use the arrow buttons. Hidden sections remain in your draft so
        you can restore them later.
      </p>
      <input name="sectionLayout" type="hidden" value={JSON.stringify(sections)} />
      <div className="mt-4 grid gap-2">
        {sections.map((section, index) => {
          const detail = sectionDetails[section.id];
          return (
            <div
              className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition ${
                draggedId === section.id
                  ? 'border-[var(--action-primary)] opacity-60'
                  : 'border-[var(--border-default)]'
              }`}
              draggable
              key={section.id}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedId(section.id)}
              onDrop={() => dropBefore(section.id)}
            >
              <span className="cursor-grab select-none text-xl text-slate-400" aria-hidden="true">
                ⋮⋮
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black">{detail.name}</span>
                <span className="block truncate text-sm text-[var(--text-secondary)]">
                  {detail.description}
                </span>
              </span>
              <button
                aria-label={`Move ${detail.name} up`}
                className="grid size-9 place-items-center rounded-lg border font-black disabled:opacity-30"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move ${detail.name} down`}
                className="grid size-9 place-items-center rounded-lg border font-black disabled:opacity-30"
                disabled={index === sections.length - 1}
                onClick={() => move(index, 1)}
                type="button"
              >
                ↓
              </button>
              <button
                aria-pressed={!section.visible}
                className="min-h-9 rounded-lg border px-3 text-sm font-bold"
                onClick={() =>
                  setSections((current) =>
                    current.map((item) =>
                      item.id === section.id ? { ...item, visible: !item.visible } : item,
                    ),
                  )
                }
                type="button"
              >
                {section.visible ? 'Visible' : 'Hidden'}
              </button>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
