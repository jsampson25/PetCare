'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readWebsiteEditorSnapshotValue,
  WEBSITE_EDITOR_RESTORE_EVENT_TYPE,
  type WebsiteEditorSnapshot,
} from './website-editor-history';
import type { WebsiteLayoutSection } from './website-live-preview';
import {
  moveWebsiteSection,
  reorderWebsiteSections,
  type WebsiteSectionDropEdge,
} from './website-section-order';

export type WebsiteSection = WebsiteLayoutSection;

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
  const [dropTarget, setDropTarget] = useState<{
    id: WebsiteSection['id'];
    edge: WebsiteSectionDropEdge;
  } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const layoutInputRef = useRef<HTMLInputElement>(null);
  const previousLayoutRef = useRef(JSON.stringify(initialSections));

  useEffect(() => {
    const serialized = JSON.stringify(sections);
    if (serialized === previousLayoutRef.current) return;
    previousLayoutRef.current = serialized;
    layoutInputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [sections]);

  useEffect(() => {
    function restoreSections(event: Event) {
      const snapshot = (event as CustomEvent<{ snapshot?: WebsiteEditorSnapshot }>).detail
        ?.snapshot;
      if (!snapshot) return;
      try {
        const restored = JSON.parse(
          readWebsiteEditorSnapshotValue(snapshot, 'sectionLayout'),
        ) as WebsiteSection[];
        if (
          Array.isArray(restored) &&
          restored.length === defaultWebsiteSections.length &&
          restored.every((section) =>
            defaultWebsiteSections.some((candidate) => candidate.id === section.id),
          )
        ) {
          setSections(restored);
        }
      } catch {
        // Ignore malformed history data and preserve the current editor state.
      }
    }

    window.addEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restoreSections);
    return () => window.removeEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restoreSections);
  }, []);

  function announcePosition(id: WebsiteSection['id'], next: WebsiteSection[]) {
    const position = next.findIndex((section) => section.id === id) + 1;
    setAnnouncement(`${sectionDetails[id].name} moved to position ${position} of ${next.length}.`);
  }

  function move(id: WebsiteSection['id'], direction: -1 | 1) {
    const next = moveWebsiteSection(sections, id, direction);
    if (next === sections) return;
    setSections(next);
    announcePosition(id, next);
  }

  function moveToBoundary(id: WebsiteSection['id'], boundary: 'first' | 'last') {
    const target = boundary === 'first' ? sections[0] : sections[sections.length - 1];
    if (!target || target.id === id) return;
    const next = reorderWebsiteSections(
      sections,
      id,
      target.id,
      boundary === 'first' ? 'before' : 'after',
    );
    setSections(next);
    announcePosition(id, next);
  }

  function dropSection() {
    if (!draggedId || !dropTarget) return;
    const next = reorderWebsiteSections(sections, draggedId, dropTarget.id, dropTarget.edge);
    if (next !== sections) {
      setSections(next);
      announcePosition(draggedId, next);
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-black">Homepage sections</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]" id="section-reorder-instructions">
        Drag a section handle and use the placement line, or focus a handle and press Arrow Up,
        Arrow Down, Home, or End. The arrow buttons provide the same non-drag alternative. Hidden
        sections remain in your draft.
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <input
        name="sectionLayout"
        ref={layoutInputRef}
        type="hidden"
        value={JSON.stringify(sections)}
      />
      <div className="mt-4 grid gap-2">
        {sections.map((section, index) => {
          const detail = sectionDetails[section.id];
          return (
            <div
              className={`relative flex items-center gap-3 rounded-xl border bg-white p-3 transition ${
                draggedId === section.id
                  ? 'border-[var(--action-primary)] opacity-60'
                  : 'border-[var(--border-default)]'
              }`}
              data-drop-edge={dropTarget?.id === section.id ? dropTarget.edge : undefined}
              key={section.id}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                ) {
                  setDropTarget((current) => (current?.id === section.id ? null : current));
                }
              }}
              onDragOver={(event) => {
                if (!draggedId || draggedId === section.id) {
                  setDropTarget(null);
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                const bounds = event.currentTarget.getBoundingClientRect();
                const edge: WebsiteSectionDropEdge =
                  event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                setDropTarget((current) =>
                  current?.id === section.id && current.edge === edge
                    ? current
                    : { id: section.id, edge },
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropSection();
              }}
            >
              {dropTarget?.id === section.id ? (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-2 h-1 rounded-full bg-[var(--action-primary)] ${
                    dropTarget.edge === 'before' ? '-top-[3px]' : '-bottom-[3px]'
                  }`}
                />
              ) : null}
              <button
                aria-describedby="section-reorder-instructions"
                aria-keyshortcuts="ArrowUp ArrowDown Home End"
                aria-label={`Reorder ${detail.name}`}
                className="min-h-9 cursor-grab rounded-lg border border-slate-200 px-2 text-xs font-black text-slate-500 active:cursor-grabbing"
                draggable
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropTarget(null);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', section.id);
                  setDraggedId(section.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    move(section.id, event.key === 'ArrowUp' ? -1 : 1);
                  } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    moveToBoundary(section.id, event.key === 'Home' ? 'first' : 'last');
                  }
                }}
                type="button"
              >
                Drag
              </button>
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
                onClick={() => move(section.id, -1)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move ${detail.name} down`}
                className="grid size-9 place-items-center rounded-lg border font-black disabled:opacity-30"
                disabled={index === sections.length - 1}
                onClick={() => move(section.id, 1)}
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
