'use client';

import { useState } from 'react';

export type WebsiteMedia = {
  id: string;
  alt_text: string;
  caption: string | null;
  category: string;
  object_path: string;
  publicUrl: string;
};

export function WebsiteMediaEditor({
  initialHeroMediaId,
  media,
}: {
  initialHeroMediaId: string;
  media: WebsiteMedia[];
}) {
  const [heroMediaId, setHeroMediaId] = useState(initialHeroMediaId);
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const selected = media.find((item) => item.id === heroMediaId);

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-black">Homepage photography</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Drag a photo into the hero area or choose it below. Uploaded media stays available when you
        switch styles and templates.
      </p>
      <input name="heroMediaId" type="hidden" value={heroMediaId} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div
          className={`relative grid min-h-64 place-items-center overflow-hidden rounded-2xl border-2 border-dashed ${draggedMediaId ? 'border-[var(--action-primary)] bg-[var(--surface-subtle)]' : 'border-[var(--border-strong)] bg-white'}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedMediaId) setHeroMediaId(draggedMediaId);
            setDraggedMediaId(null);
          }}
        >
          {selected ? (
            <>
              <div
                aria-label={selected.alt_text}
                className="absolute inset-0 bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url(${selected.publicUrl})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
                <span className="text-sm font-bold">Hero image</span>
                <button
                  className="rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-slate-900"
                  onClick={() => setHeroMediaId('')}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <div className="max-w-xs p-6 text-center">
              <span className="text-3xl" aria-hidden="true">
                ▧
              </span>
              <p className="mt-3 font-black">Drop a hero photo here</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Landscape images work best. The focal area stays centered on smaller screens.
              </p>
            </div>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
          {media.length ? (
            <div className="grid grid-cols-2 gap-3">
              {media.map((item) => (
                <button
                  className={`overflow-hidden rounded-xl border bg-white text-left ${heroMediaId === item.id ? 'border-[var(--action-primary)] ring-2 ring-[var(--action-primary)]/15' : 'border-[var(--border-default)]'}`}
                  draggable
                  key={item.id}
                  onClick={() => setHeroMediaId(item.id)}
                  onDragEnd={() => setDraggedMediaId(null)}
                  onDragStart={() => setDraggedMediaId(item.id)}
                  type="button"
                >
                  <span
                    aria-label={item.alt_text}
                    className="block aspect-[4/3] w-full bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${item.publicUrl})` }}
                  />
                  <span className="block truncate px-2 py-2 text-xs font-bold">
                    {item.alt_text}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center p-5 text-center text-sm text-[var(--text-secondary)]">
              Upload your first photo below, then it will appear here.
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
