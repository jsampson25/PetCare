'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readWebsiteEditorSnapshotValue,
  WEBSITE_EDITOR_RESTORE_EVENT_TYPE,
  type WebsiteEditorSnapshot,
} from './website-editor-history';
import {
  addWebsiteSection,
  defaultWebsiteSectionLayout,
  isWebsiteSectionLayout,
  removeWebsiteSection,
  websiteOptionalSectionIds,
  websiteSectionCatalog,
  type WebsiteLayoutSection,
} from './website-section-catalog';
import {
  moveWebsiteSection,
  reorderWebsiteSections,
  type WebsiteSectionDropEdge,
} from './website-section-order';

export type WebsiteSection = WebsiteLayoutSection;

const sectionDetails = websiteSectionCatalog;
export const defaultWebsiteSections: WebsiteSection[] = defaultWebsiteSectionLayout;

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
        if (isWebsiteSectionLayout(restored)) {
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
              {detail.optional ? (
                <button
                  aria-label={`Remove ${detail.name}`}
                  className="min-h-9 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700"
                  onClick={() => {
                    setSections((current) => removeWebsiteSection(current, section.id));
                    setAnnouncement(`${detail.name} removed from the homepage.`);
                  }}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-6 rounded-xl border border-dashed border-[var(--border-strong)] bg-slate-50 p-4">
        <p className="font-black">Approved section library</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Add a predesigned block. Every block follows your selected style and remains safe on
          mobile.
        </p>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {websiteOptionalSectionIds.map((id) => {
            const detail = sectionDetails[id];
            const added = sections.some((section) => section.id === id);
            return (
              <button
                className="rounded-xl border border-[var(--border-default)] bg-white p-3 text-left disabled:cursor-default disabled:opacity-60"
                disabled={added}
                key={id}
                onClick={() => {
                  setSections((current) => addWebsiteSection(current, id));
                  setAnnouncement(`${detail.name} added to the homepage.`);
                }}
                type="button"
              >
                <span className="block font-black">{detail.name}</span>
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                  {detail.description}
                </span>
                <span className="mt-2 block text-xs font-black text-[var(--action-primary)]">
                  {added ? 'Added' : '+ Add section'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
