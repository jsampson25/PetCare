'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readWebsiteEditorSnapshotValue,
  WEBSITE_EDITOR_RESTORE_EVENT_TYPE,
  type WebsiteEditorSnapshot,
} from './website-editor-history';
import {
  createUniqueWebsitePageSlug,
  isWebsiteCustomPageList,
  maxWebsiteCustomPages,
  maxWebsiteNavigationPages,
  normalizeWebsitePageSlugInput,
  reservedWebsitePageSlugs,
  slugifyWebsitePageTitle,
  type WebsiteCustomPage,
} from './website-custom-pages';

export type { WebsiteCustomPage } from './website-custom-pages';

function makePage(pages: WebsiteCustomPage[]): WebsiteCustomPage {
  return {
    id: crypto.randomUUID(),
    title: 'New page',
    slug: createUniqueWebsitePageSlug('New page', pages),
    body: '',
    showInNavigation: false,
  };
}

export function WebsiteCustomPagesEditor({ initialPages }: { initialPages: WebsiteCustomPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [announcement, setAnnouncement] = useState('');
  const pagesInputRef = useRef<HTMLInputElement>(null);
  const previousPagesRef = useRef(JSON.stringify(initialPages));

  useEffect(() => {
    const serialized = JSON.stringify(pages);
    if (serialized === previousPagesRef.current) return;
    previousPagesRef.current = serialized;
    pagesInputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [pages]);

  useEffect(() => {
    function restorePages(event: Event) {
      const snapshot = (event as CustomEvent<{ snapshot?: WebsiteEditorSnapshot }>).detail
        ?.snapshot;
      if (!snapshot) return;
      try {
        const restored = JSON.parse(
          readWebsiteEditorSnapshotValue(snapshot, 'customPages'),
        ) as WebsiteCustomPage[];
        if (isWebsiteCustomPageList(restored)) setPages(restored);
      } catch {
        // Ignore malformed history data and preserve the current editor state.
      }
    }

    window.addEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restorePages);
    return () => window.removeEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restorePages);
  }, []);

  function updatePage(id: string, values: Partial<WebsiteCustomPage>) {
    setPages((current) => current.map((page) => (page.id === id ? { ...page, ...values } : page)));
  }

  function movePage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    setPages((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      setAnnouncement(
        `${next[target]?.title ?? 'Page'} moved to position ${target + 1} of ${next.length}.`,
      );
      return next;
    });
  }

  const navigationCount = pages.filter((page) => page.showInNavigation).length;
  const slugCounts = pages.reduce(
    (counts, page) => counts.set(page.slug, (counts.get(page.slug) ?? 0) + 1),
    new Map<string, number>(),
  );
  const duplicateSlugs = new Set(
    [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug),
  );

  return (
    <fieldset className="sm:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <legend className="text-sm font-black">Custom pages</legend>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Add pages such as policies, what to bring, facility details, or first-visit guidance.
            Page order also controls the order of custom links in your navigation.
          </p>
        </div>
        <button
          className="min-h-10 rounded-lg border border-[var(--border-default)] bg-white px-4 text-sm font-black"
          disabled={pages.length >= maxWebsiteCustomPages}
          onClick={() => setPages((current) => [...current, makePage(current)])}
          type="button"
        >
          Add custom page
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-black">Main navigation</p>
          <p className="text-xs font-bold text-[var(--text-secondary)]">
            {navigationCount} of {maxWebsiteNavigationPages} custom links used
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          {['Home', 'Services', 'About', 'FAQ', 'Contact'].map((label) => (
            <span className="rounded-full border bg-white px-3 py-1.5" key={label}>
              {label}
            </span>
          ))}
          {pages
            .filter((page) => page.showInNavigation)
            .map((page) => (
              <span
                className="rounded-full bg-[var(--action-primary)] px-3 py-1.5 text-white"
                key={page.id}
              >
                {page.title || 'Untitled page'}
              </span>
            ))}
        </div>
      </div>
      <input name="customPages" ref={pagesInputRef} type="hidden" value={JSON.stringify(pages)} />
      <div className="mt-4 grid gap-4">
        {pages.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-[var(--text-secondary)]">
            No custom pages yet. Your standard Home, Services, FAQ, Contact, Booking, and Portal
            pages remain available.
          </div>
        ) : null}
        {pages.map((page, index) => (
          <article className="rounded-2xl border bg-white p-4" key={page.id}>
            <div className="flex items-center justify-between gap-4">
              <p className="font-black">Custom page {index + 1}</p>
              <div className="flex items-center gap-2">
                <button
                  aria-label={`Move ${page.title} up`}
                  className="grid size-9 place-items-center rounded-lg border font-black disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => movePage(index, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${page.title} down`}
                  className="grid size-9 place-items-center rounded-lg border font-black disabled:opacity-30"
                  disabled={index === pages.length - 1}
                  onClick={() => movePage(index, 1)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label={`Remove ${page.title}`}
                  className="min-h-9 rounded-lg px-2 text-sm font-bold text-red-700"
                  onClick={() =>
                    setPages((current) => current.filter((item) => item.id !== page.id))
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Page title
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border px-3"
                  maxLength={80}
                  onChange={(event) => updatePage(page.id, { title: event.target.value })}
                  value={page.title}
                />
              </label>
              <label className="text-sm font-bold">
                Page address
                <span className="mt-2 flex min-h-11 items-center rounded-lg border bg-slate-50 px-3 font-normal">
                  /pages/
                  <input
                    className="min-w-0 flex-1 bg-transparent outline-none"
                    maxLength={60}
                    onBlur={() => updatePage(page.id, { slug: slugifyWebsitePageTitle(page.slug) })}
                    onChange={(event) =>
                      updatePage(page.id, {
                        slug: normalizeWebsitePageSlugInput(event.target.value),
                      })
                    }
                    value={page.slug}
                  />
                </span>
                <span className="mt-2 flex items-center justify-between gap-2 text-xs font-normal">
                  <span
                    className={
                      reservedWebsitePageSlugs.has(page.slug) || duplicateSlugs.has(page.slug)
                        ? 'font-bold text-red-700'
                        : 'text-[var(--text-secondary)]'
                    }
                  >
                    {reservedWebsitePageSlugs.has(page.slug)
                      ? 'Choose a different address; this one is reserved.'
                      : duplicateSlugs.has(page.slug)
                        ? 'Each page needs a unique address.'
                        : 'Lowercase letters, numbers, and hyphens.'}
                  </span>
                  <button
                    className="shrink-0 font-bold text-[var(--action-primary)]"
                    onClick={() =>
                      updatePage(page.id, {
                        slug: createUniqueWebsitePageSlug(
                          page.title,
                          pages.filter((candidate) => candidate.id !== page.id),
                        ),
                      })
                    }
                    type="button"
                  >
                    Use title
                  </button>
                </span>
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Page content
                <textarea
                  className="mt-2 min-h-32 w-full rounded-lg border p-3 font-normal"
                  maxLength={10000}
                  onChange={(event) => updatePage(page.id, { body: event.target.value })}
                  placeholder="Write the customer-facing page content."
                  value={page.body}
                />
              </label>
              <label className="flex items-center gap-3 text-sm font-bold sm:col-span-2">
                <input
                  checked={page.showInNavigation}
                  disabled={!page.showInNavigation && navigationCount >= maxWebsiteNavigationPages}
                  onChange={(event) =>
                    updatePage(page.id, { showInNavigation: event.target.checked })
                  }
                  type="checkbox"
                />
                Show this page in the main website navigation
              </label>
            </div>
          </article>
        ))}
      </div>
    </fieldset>
  );
}
