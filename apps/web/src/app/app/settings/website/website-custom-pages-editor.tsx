'use client';

import { useState } from 'react';

export type WebsiteCustomPage = {
  id: string;
  title: string;
  slug: string;
  body: string;
  showInNavigation: boolean;
};

function makePage(): WebsiteCustomPage {
  return {
    id: crypto.randomUUID(),
    title: 'New page',
    slug: 'new-page',
    body: '',
    showInNavigation: false,
  };
}

export function WebsiteCustomPagesEditor({ initialPages }: { initialPages: WebsiteCustomPage[] }) {
  const [pages, setPages] = useState(initialPages);

  function updatePage(id: string, values: Partial<WebsiteCustomPage>) {
    setPages((current) => current.map((page) => (page.id === id ? { ...page, ...values } : page)));
  }

  return (
    <fieldset className="sm:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <legend className="text-sm font-black">Custom pages</legend>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Add pages such as policies, what to bring, facility details, or first-visit guidance.
          </p>
        </div>
        <button
          className="min-h-10 rounded-lg border border-[var(--border-default)] bg-white px-4 text-sm font-black"
          disabled={pages.length >= 10}
          onClick={() => setPages((current) => [...current, makePage()])}
          type="button"
        >
          Add custom page
        </button>
      </div>
      <input name="customPages" type="hidden" value={JSON.stringify(pages)} />
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
              <button
                className="text-sm font-bold text-red-700"
                onClick={() => setPages((current) => current.filter((item) => item.id !== page.id))}
                type="button"
              >
                Remove
              </button>
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
                    onChange={(event) =>
                      updatePage(page.id, {
                        slug: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, '-')
                          .replace(/-+/g, '-'),
                      })
                    }
                    value={page.slug}
                  />
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
