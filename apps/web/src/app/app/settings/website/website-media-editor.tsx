'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readWebsiteEditorSnapshotValue,
  WEBSITE_EDITOR_RESTORE_EVENT_TYPE,
  type WebsiteEditorSnapshot,
} from './website-editor-history';

export type WebsiteMedia = {
  id: string;
  alt_text: string;
  caption: string | null;
  category: string;
  object_path: string;
  publicUrl: string;
};

type Slot = 'logo' | 'hero' | 'services' | 'about';
type FocalSlot = Exclude<Slot, 'logo'>;
type FocalPoint = { x: number; y: number };

const slots: Array<{ id: Slot; name: string; hint: string }> = [
  { id: 'logo', name: 'Business logo', hint: 'A transparent PNG works best' },
  { id: 'hero', name: 'Hero image', hint: 'Wide, welcoming first impression' },
  { id: 'services', name: 'Services image', hint: 'Care, play, grooming, or rooms' },
  { id: 'about', name: 'About image', hint: 'Your team, family, or facility' },
];

export function WebsiteMediaEditor({
  initialAboutMediaId,
  initialHeroMediaId,
  initialLogoMediaId,
  initialServicesMediaId,
  initialFocalPoints,
  media,
}: {
  initialAboutMediaId: string;
  initialHeroMediaId: string;
  initialLogoMediaId: string;
  initialServicesMediaId: string;
  initialFocalPoints: Record<FocalSlot, FocalPoint>;
  media: WebsiteMedia[];
}) {
  const [selection, setSelection] = useState<Record<Slot, string>>({
    logo: initialLogoMediaId,
    hero: initialHeroMediaId,
    services: initialServicesMediaId,
    about: initialAboutMediaId,
  });
  const [focalPoints, setFocalPoints] = useState(initialFocalPoints);
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const previousSelectionRef = useRef(JSON.stringify({ selection, focalPoints }));

  useEffect(() => {
    const serialized = JSON.stringify({ selection, focalPoints });
    if (serialized === previousSelectionRef.current) return;
    previousSelectionRef.current = serialized;
    mediaInputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [focalPoints, selection]);

  useEffect(() => {
    function restoreSelection(event: Event) {
      const snapshot = (event as CustomEvent<{ snapshot?: WebsiteEditorSnapshot }>).detail
        ?.snapshot;
      if (!snapshot) return;
      setSelection({
        about: readWebsiteEditorSnapshotValue(snapshot, 'aboutMediaId'),
        hero: readWebsiteEditorSnapshotValue(snapshot, 'heroMediaId'),
        logo: readWebsiteEditorSnapshotValue(snapshot, 'logoMediaId'),
        services: readWebsiteEditorSnapshotValue(snapshot, 'servicesMediaId'),
      });
      const readFocal = (slot: FocalSlot, axis: 'X' | 'Y') => {
        const value = Number(readWebsiteEditorSnapshotValue(snapshot, `${slot}Focal${axis}`));
        return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 50;
      };
      setFocalPoints({
        hero: { x: readFocal('hero', 'X'), y: readFocal('hero', 'Y') },
        services: { x: readFocal('services', 'X'), y: readFocal('services', 'Y') },
        about: { x: readFocal('about', 'X'), y: readFocal('about', 'Y') },
      });
    }

    window.addEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restoreSelection);
    return () => window.removeEventListener(WEBSITE_EDITOR_RESTORE_EVENT_TYPE, restoreSelection);
  }, []);

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-black">Website photography</legend>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Drag photos into each section or use the placement buttons. Images stay available when you
        change styles and templates.
      </p>
      <input name="logoMediaId" ref={mediaInputRef} type="hidden" value={selection.logo} />
      <input name="heroMediaId" type="hidden" value={selection.hero} />
      <input name="servicesMediaId" type="hidden" value={selection.services} />
      <input name="aboutMediaId" type="hidden" value={selection.about} />
      {(Object.entries(focalPoints) as Array<[FocalSlot, FocalPoint]>).flatMap(([slot, point]) => [
        <input key={`${slot}-x`} name={`${slot}FocalX`} type="hidden" value={point.x} />,
        <input key={`${slot}-y`} name={`${slot}FocalY`} type="hidden" value={point.y} />,
      ])}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => {
            const selected = media.find((item) => item.id === selection[slot.id]);
            return (
              <div
                className={`relative grid min-h-52 place-items-center overflow-hidden rounded-2xl border-2 border-dashed ${
                  draggedMediaId
                    ? 'border-[var(--action-primary)] bg-[var(--surface-subtle)]'
                    : 'border-[var(--border-strong)] bg-white'
                }`}
                key={slot.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedMediaId) {
                    setSelection((current) => ({ ...current, [slot.id]: draggedMediaId }));
                  }
                  setDraggedMediaId(null);
                }}
              >
                {selected ? (
                  <>
                    <div
                      aria-label={selected.alt_text}
                      className={`absolute inset-0 bg-center ${
                        slot.id === 'logo' ? 'bg-contain bg-no-repeat p-6' : 'bg-cover'
                      }`}
                      role="img"
                      style={{
                        backgroundImage: `url(${selected.publicUrl})`,
                        backgroundPosition:
                          slot.id === 'logo'
                            ? 'center'
                            : `${focalPoints[slot.id].x}% ${focalPoints[slot.id].y}%`,
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                    <div className="absolute inset-x-3 bottom-3 text-white">
                      <p className="text-sm font-black">{slot.name}</p>
                      <button
                        className="mt-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900"
                        onClick={() => setSelection((current) => ({ ...current, [slot.id]: '' }))}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                    {slot.id !== 'logo' ? (
                      <div className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 text-slate-950 shadow-lg">
                        <p className="text-xs font-black">Crop focus</p>
                        <label className="mt-2 grid grid-cols-[3rem_1fr] items-center gap-2 text-xs font-bold">
                          Left
                          <input
                            aria-label={`${slot.name} horizontal crop focus`}
                            max="100"
                            min="0"
                            onChange={(event) =>
                              setFocalPoints((current) => ({
                                ...current,
                                [slot.id]: {
                                  ...current[slot.id as FocalSlot],
                                  x: Number(event.target.value),
                                },
                              }))
                            }
                            type="range"
                            value={focalPoints[slot.id as FocalSlot].x}
                          />
                        </label>
                        <label className="mt-1 grid grid-cols-[3rem_1fr] items-center gap-2 text-xs font-bold">
                          Top
                          <input
                            aria-label={`${slot.name} vertical crop focus`}
                            max="100"
                            min="0"
                            onChange={(event) =>
                              setFocalPoints((current) => ({
                                ...current,
                                [slot.id]: {
                                  ...current[slot.id as FocalSlot],
                                  y: Number(event.target.value),
                                },
                              }))
                            }
                            type="range"
                            value={focalPoints[slot.id as FocalSlot].y}
                          />
                        </label>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <span className="text-3xl text-slate-400" aria-hidden="true">
                      +
                    </span>
                    <p className="mt-2 font-black">{slot.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      {slot.hint}
                    </p>
                    <p className="mt-3 text-xs font-bold text-[var(--action-primary)]">
                      Drop a photo here
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="max-h-[30rem] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
          {media.length ? (
            <div className="grid gap-3">
              {media.map((item) => (
                <div
                  className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-white"
                  draggable
                  key={item.id}
                  onDragEnd={() => setDraggedMediaId(null)}
                  onDragStart={() => setDraggedMediaId(item.id)}
                >
                  <div className="grid grid-cols-[5.5rem_1fr]">
                    <span
                      aria-label={item.alt_text}
                      className="min-h-24 bg-cover bg-center"
                      role="img"
                      style={{ backgroundImage: `url(${item.publicUrl})` }}
                    />
                    <span className="min-w-0 p-3">
                      <span className="block truncate text-sm font-black">{item.alt_text}</span>
                      <span className="mt-2 grid gap-1">
                        {slots.map((slot) => (
                          <button
                            className={`rounded-lg px-2 py-1 text-left text-xs font-bold ${
                              selection[slot.id] === item.id
                                ? 'bg-[var(--action-primary)] text-white'
                                : 'bg-[var(--surface-subtle)] hover:bg-slate-200'
                            }`}
                            key={slot.id}
                            onClick={() =>
                              setSelection((current) => ({ ...current, [slot.id]: item.id }))
                            }
                            type="button"
                          >
                            {selection[slot.id] === item.id ? '✓ ' : '+ '}
                            {slot.name}
                          </button>
                        ))}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center p-5 text-center text-sm text-[var(--text-secondary)]">
              Upload your first photo above, then it will appear here.
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
