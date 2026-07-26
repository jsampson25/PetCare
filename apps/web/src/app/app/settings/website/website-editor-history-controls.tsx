'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  appendWebsiteEditorSnapshot,
  createWebsiteEditorSnapshot,
  serializeWebsiteEditorSnapshot,
  WEBSITE_EDITOR_HISTORY_EVENT_TYPE,
  WEBSITE_EDITOR_RESTORE_EVENT_TYPE,
  type WebsiteEditorHistory,
  type WebsiteEditorSnapshot,
} from './website-editor-history';

const controlledFieldNames = new Set([
  'aboutMediaId',
  'customPages',
  'heroMediaId',
  'heroFocalX',
  'heroFocalY',
  'logoMediaId',
  'sectionLayout',
  'servicesMediaId',
  'servicesFocalX',
  'servicesFocalY',
  'aboutFocalX',
  'aboutFocalY',
]);

function restoreNativeFields(form: HTMLFormElement, snapshot: WebsiteEditorSnapshot) {
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) ||
      !element.name ||
      controlledFieldNames.has(element.name)
    ) {
      continue;
    }

    const values = snapshot[element.name] ?? [];
    if (
      element instanceof HTMLInputElement &&
      (element.type === 'checkbox' || element.type === 'radio')
    ) {
      element.checked = values.includes(element.value);
    } else {
      element.value = values[0] ?? '';
    }
  }
}

export function WebsiteEditorHistoryControls({ initiallyDirty }: { initiallyDirty: boolean }) {
  const { pending } = useFormStatus();
  const [dirty, setDirty] = useState(initiallyDirty);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const baselineRef = useRef('');
  const dirtyRef = useRef(initiallyDirty);
  const historyRef = useRef<WebsiteEditorHistory>({ entries: [], index: 0 });
  const restoringRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const formElement = document.querySelector<HTMLFormElement>('[data-website-draft-form]');
    if (!formElement) return;
    const form: HTMLFormElement = formElement;

    const initial = createWebsiteEditorSnapshot(new FormData(form));
    baselineRef.current = serializeWebsiteEditorSnapshot(initial);
    historyRef.current = { entries: [initial], index: 0 };
    let captureTimer = 0;

    function updateDirty(snapshot: WebsiteEditorSnapshot) {
      const nextDirty =
        initiallyDirty || serializeWebsiteEditorSnapshot(snapshot) !== baselineRef.current;
      dirtyRef.current = nextDirty;
      setDirty(nextDirty);
    }

    function capture() {
      if (restoringRef.current) return;
      const snapshot = createWebsiteEditorSnapshot(new FormData(form));
      const next = appendWebsiteEditorSnapshot(historyRef.current, snapshot);
      historyRef.current = next;
      setHistoryIndex(next.index);
      setHistoryLength(next.entries.length);
      updateDirty(snapshot);
    }

    function scheduleCapture() {
      if (restoringRef.current) return;
      window.clearTimeout(captureTimer);
      updateDirty(createWebsiteEditorSnapshot(new FormData(form)));
      captureTimer = window.setTimeout(capture, 300);
    }

    function restore(index: number) {
      const snapshot = historyRef.current.entries[index];
      if (!snapshot) return;
      window.clearTimeout(captureTimer);
      restoringRef.current = true;
      historyRef.current = { ...historyRef.current, index };
      setHistoryIndex(index);
      restoreNativeFields(form, snapshot);
      window.dispatchEvent(
        new CustomEvent(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, { detail: { snapshot } }),
      );
      updateDirty(snapshot);
      window.setTimeout(() => {
        form.dispatchEvent(new Event('input', { bubbles: true }));
        restoringRef.current = false;
      });
    }

    function handleHistoryAction(event: Event) {
      const direction = (event as CustomEvent<{ direction?: unknown }>).detail?.direction;
      const nextIndex =
        direction === 'undo'
          ? historyRef.current.index - 1
          : direction === 'redo'
            ? historyRef.current.index + 1
            : historyRef.current.index;
      restore(nextIndex);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const direction = key === 'y' || (key === 'z' && event.shiftKey) ? 'redo' : 'undo';
      if (key !== 'z' && key !== 'y') return;
      const nextIndex =
        direction === 'undo' ? historyRef.current.index - 1 : historyRef.current.index + 1;
      if (!historyRef.current.entries[nextIndex]) return;
      event.preventDefault();
      restore(nextIndex);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || submittingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!dirtyRef.current || submittingRef.current || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      const sameDocument =
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search;
      if (destination.href === window.location.href || (sameDocument && destination.hash)) return;
      if (!window.confirm('Leave this page? Your unsaved website changes will be lost.')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handleSubmit() {
      submittingRef.current = true;
    }

    form.addEventListener('input', scheduleCapture);
    form.addEventListener('change', scheduleCapture);
    form.addEventListener('submit', handleSubmit);
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener(WEBSITE_EDITOR_HISTORY_EVENT_TYPE, handleHistoryAction);
    return () => {
      window.clearTimeout(captureTimer);
      form.removeEventListener('input', scheduleCapture);
      form.removeEventListener('change', scheduleCapture);
      form.removeEventListener('submit', handleSubmit);
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener(WEBSITE_EDITOR_HISTORY_EVENT_TYPE, handleHistoryAction);
    };
  }, [initiallyDirty]);

  useEffect(() => {
    if (!pending) submittingRef.current = false;
  }, [pending]);

  function requestHistory(direction: 'undo' | 'redo') {
    window.dispatchEvent(
      new CustomEvent(WEBSITE_EDITOR_HISTORY_EVENT_TYPE, { detail: { direction } }),
    );
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:col-span-2">
      <div className="flex items-center gap-2">
        <button
          className="min-h-10 rounded-xl border px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
          disabled={historyIndex <= 0}
          onClick={() => requestHistory('undo')}
          type="button"
        >
          Undo
        </button>
        <button
          className="min-h-10 rounded-xl border px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
          disabled={historyIndex >= historyLength - 1}
          onClick={() => requestHistory('redo')}
          type="button"
        >
          Redo
        </button>
      </div>
      <div aria-live="polite" className="flex flex-wrap items-center justify-end gap-3 text-sm">
        <span className="text-slate-500">Autosave off</span>
        <span className={`font-black ${dirty ? 'text-amber-700' : 'text-emerald-700'}`}>
          {pending ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--action-primary)] px-4 font-black text-[var(--action-primary-text)] disabled:opacity-55"
          disabled={pending || !dirty}
          type="submit"
        >
          {pending ? 'Saving...' : 'Save draft'}
        </button>
      </div>
    </div>
  );
}
