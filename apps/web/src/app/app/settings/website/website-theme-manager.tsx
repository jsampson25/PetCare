'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createWebsiteEditorSnapshot,
  readWebsiteEditorSnapshotValue,
  WEBSITE_EDITOR_APPLY_SNAPSHOT_EVENT_TYPE,
  WEBSITE_EDITOR_RESTORE_EVENT_TYPE,
  type WebsiteEditorSnapshot,
} from './website-editor-history';
import {
  createTemplateResetSnapshot,
  createWebsiteThemeCopy,
  isWebsiteThemeCopyList,
  maxWebsiteThemeCopies,
  type WebsiteThemeCopy,
} from './website-theme-copies';
import type { WebsiteStyle, WebsiteTemplate } from './website-theme-catalog';

export function WebsiteThemeManager({
  initialCopies,
  style,
  template,
}: {
  initialCopies: WebsiteThemeCopy[];
  style: WebsiteStyle;
  template: WebsiteTemplate;
}) {
  const [copies, setCopies] = useState(initialCopies);
  const [copyName, setCopyName] = useState(`${template.name} copy`);
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previousCopiesRef = useRef(JSON.stringify(initialCopies));

  useEffect(() => {
    const serialized = JSON.stringify(copies);
    if (serialized === previousCopiesRef.current) return;
    previousCopiesRef.current = serialized;
    inputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [copies]);

  useEffect(() => {
    function restoreCopies(event: Event) {
      const snapshot = (event as CustomEvent<{ snapshot?: WebsiteEditorSnapshot }>).detail
        ?.snapshot;
      if (!snapshot) return;
      try {
        const restored = JSON.parse(readWebsiteEditorSnapshotValue(snapshot, 'themeCopies'));
        if (isWebsiteThemeCopyList(restored)) setCopies(restored);
      } catch {
        // Ignore malformed history data and preserve the current design copies.
      }
    }
    window.addEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restoreCopies);
    return () => window.removeEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restoreCopies);
  }, []);

  function currentForm() {
    return document.querySelector<HTMLFormElement>('[data-website-draft-form]');
  }

  function applySnapshot(snapshot: WebsiteEditorSnapshot) {
    window.dispatchEvent(
      new CustomEvent(WEBSITE_EDITOR_APPLY_SNAPSHOT_EVENT_TYPE, { detail: { snapshot } }),
    );
  }

  function duplicateDesign() {
    const form = currentForm();
    const name = copyName.trim();
    if (!form || !name || copies.length >= maxWebsiteThemeCopies) return;
    const copy = createWebsiteThemeCopy({
      id: crypto.randomUUID(),
      name,
      now: new Date().toISOString(),
      snapshot: createWebsiteEditorSnapshot(new FormData(form)),
    });
    setCopies((current) => [...current, copy]);
    setCopyName(`${template.name} copy ${copies.length + 2}`);
    setAnnouncement(`${copy.name} created. Save the website draft to keep this design copy.`);
  }

  function restoreCopy(copy: WebsiteThemeCopy) {
    const form = currentForm();
    if (!form || copy.theme !== style.key || copy.template !== template.key) return;
    const current = createWebsiteEditorSnapshot(new FormData(form));
    applySnapshot({ ...current, ...copy.values, themeCopies: [JSON.stringify(copies)] });
    setAnnouncement(`${copy.name} applied. You can undo this change before saving.`);
  }

  function resetTemplate() {
    const form = currentForm();
    if (!form) return;
    if (
      !window.confirm(
        `Reset ${template.name} design settings? Your written content and custom pages will stay, but colors, section layout, and image placements will return to template defaults.`,
      )
    )
      return;
    const current = createWebsiteEditorSnapshot(new FormData(form));
    applySnapshot({
      ...createTemplateResetSnapshot(current, style, template),
      themeCopies: [JSON.stringify(copies)],
    });
    setAnnouncement('Template defaults applied. You can undo this change before saving.');
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
      <input name="themeCopies" ref={inputRef} type="hidden" value={JSON.stringify(copies)} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-black text-[#0b1f3a]">Design copies and reset</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Save up to five reusable design options without duplicating your written content. Reset
            restores this template&apos;s colors, layout, and image placements only.
          </p>
        </div>
        <button
          className="min-h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-700"
          onClick={resetTemplate}
          type="button"
        >
          Reset template design
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          aria-label="Design copy name"
          className="min-h-10 min-w-56 flex-1 rounded-xl border bg-white px-3 text-sm"
          maxLength={80}
          onChange={(event) => setCopyName(event.target.value)}
          value={copyName}
        />
        <button
          className="min-h-10 rounded-xl bg-[var(--action-primary)] px-4 text-sm font-black text-[var(--action-primary-text)] disabled:opacity-50"
          disabled={!copyName.trim() || copies.length >= maxWebsiteThemeCopies}
          onClick={duplicateDesign}
          type="button"
        >
          Duplicate current design
        </button>
      </div>
      <p aria-live="polite" className="mt-2 text-xs font-bold text-[var(--text-secondary)]">
        {announcement || `${copies.length} of ${maxWebsiteThemeCopies} design copies saved.`}
      </p>
      {copies.length ? (
        <div className="mt-4 grid gap-2">
          {copies.map((copy) => {
            const compatible = copy.theme === style.key && copy.template === template.key;
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3"
                key={copy.id}
              >
                <div>
                  <p className="font-black">{copy.name}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {copy.template} · {copy.createdAt.slice(0, 10)}
                    {!compatible ? ' · Open its original template to apply' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="min-h-9 rounded-lg border px-3 text-xs font-black disabled:opacity-40"
                    disabled={!compatible}
                    onClick={() => restoreCopy(copy)}
                    type="button"
                  >
                    Apply copy
                  </button>
                  <button
                    aria-label={`Delete ${copy.name}`}
                    className="min-h-9 rounded-lg px-3 text-xs font-black text-red-700"
                    onClick={() =>
                      setCopies((current) => current.filter((item) => item.id !== copy.id))
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
