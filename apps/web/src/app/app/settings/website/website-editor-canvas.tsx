'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWebsiteLivePreviewMessage,
  createWebsitePreviewPath,
  createWebsitePreviewSectionMessage,
  isWebsitePreviewSection,
  parseWebsitePreviewSectionMessage,
  type WebsiteLivePreviewMessage,
  type WebsitePreviewMediaCatalogItem,
  WEBSITE_EDITOR_SECTION_EVENT_TYPE,
  WEBSITE_PREVIEW_READY_MESSAGE_TYPE,
  type WebsitePreviewSection,
} from './website-live-preview';

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const previewDevices: Array<{ key: PreviewDevice; label: string; width: string }> = [
  { key: 'desktop', label: 'Desktop', width: '100%' },
  { key: 'tablet', label: 'Tablet', width: '48rem' },
  { key: 'mobile', label: 'Mobile', width: '24.375rem' },
];

export function WebsiteEditorCanvas({
  isThemeTrial,
  media,
  publicSlug,
  siteStatus,
  template,
  theme,
}: {
  isThemeTrial: boolean;
  media: WebsitePreviewMediaCatalogItem[];
  publicSlug?: string | null;
  siteStatus: string;
  template: string;
  theme: string;
}) {
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasUnsavedPreview, setHasUnsavedPreview] = useState(isThemeTrial);
  const [selectedSection, setSelectedSection] = useState<WebsitePreviewSection>('hero');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const latestMessageRef = useRef<WebsiteLivePreviewMessage | null>(null);
  const selectedSectionRef = useRef<WebsitePreviewSection>('hero');
  const selectedDevice = previewDevices.find((item) => item.key === device) ?? previewDevices[0];
  const embeddedPreviewPath = createWebsitePreviewPath({ frame: true, template, theme });
  const previewStudioPath = createWebsitePreviewPath({ template, theme });

  const sendLatestPreview = useCallback(() => {
    if (!latestMessageRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(latestMessageRef.current, window.location.origin);
  }, []);

  const sendSelectedSection = useCallback((section = selectedSectionRef.current) => {
    if (!section) return;
    iframeRef.current?.contentWindow?.postMessage(
      createWebsitePreviewSectionMessage(section),
      window.location.origin,
    );
  }, []);

  const selectEditorSection = useCallback(
    (section: WebsitePreviewSection, notifyInspector: boolean) => {
      selectedSectionRef.current = section;
      setSelectedSection(section);
      sendSelectedSection(section);
      if (notifyInspector) {
        window.dispatchEvent(
          new CustomEvent(WEBSITE_EDITOR_SECTION_EVENT_TYPE, {
            detail: { section, source: 'canvas' },
          }),
        );
      }
    },
    [sendSelectedSection],
  );

  useEffect(() => {
    let animationFrame = 0;

    function syncDraft() {
      const form = document.querySelector<HTMLFormElement>('[data-website-draft-form]');
      if (!form) return;
      latestMessageRef.current = createWebsiteLivePreviewMessage(new FormData(form), media);
      setHasUnsavedPreview(true);
      sendLatestPreview();
    }

    function scheduleSync(event: Event) {
      const form = document.querySelector<HTMLFormElement>('[data-website-draft-form]');
      if (!(event.target instanceof Node) || !form?.contains(event.target)) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(syncDraft);
    }

    function receivePreviewReady(event: MessageEvent) {
      if (
        event.origin === window.location.origin &&
        event.source === iframeRef.current?.contentWindow
      ) {
        const sectionMessage = parseWebsitePreviewSectionMessage(event.data);
        if (sectionMessage) {
          selectEditorSection(sectionMessage.payload.section, true);
          return;
        }
      }

      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== 'object' ||
        (event.data as { type?: string }).type !== WEBSITE_PREVIEW_READY_MESSAGE_TYPE
      ) {
        return;
      }
      sendLatestPreview();
      sendSelectedSection();
    }

    function receiveInspectorSelection(event: Event) {
      const detail = (event as CustomEvent<{ section?: unknown; source?: unknown }>).detail;
      if (detail?.source !== 'inspector' || !isWebsitePreviewSection(detail.section)) return;
      selectEditorSection(detail.section, false);
    }

    document.addEventListener('input', scheduleSync);
    document.addEventListener('change', scheduleSync);
    window.addEventListener('message', receivePreviewReady);
    window.addEventListener(WEBSITE_EDITOR_SECTION_EVENT_TYPE, receiveInspectorSelection);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('input', scheduleSync);
      document.removeEventListener('change', scheduleSync);
      window.removeEventListener('message', receivePreviewReady);
      window.removeEventListener(WEBSITE_EDITOR_SECTION_EVENT_TYPE, receiveInspectorSelection);
    };
  }, [media, selectEditorSection, sendLatestPreview, sendSelectedSection]);

  return (
    <aside aria-label="Website draft canvas" className="self-start xl:sticky xl:top-6">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-slate-300 bg-slate-950 shadow-[0_24px_70px_rgba(15,23,42,.18)]">
        <div className="border-b border-white/10 px-4 py-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black">Live draft canvas</h2>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-slate-200">
                  {siteStatus.replaceAll('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Content, layout, colors, and images update here before you save.
              </p>
              <p className="mt-1 text-xs font-bold text-blue-300">
                Click a website section to edit its matching controls.
              </p>
            </div>
            <button
              className="min-h-9 rounded-lg border border-white/15 px-3 text-xs font-black text-white hover:bg-white/10"
              onClick={() => setRefreshKey((current) => current + 1)}
              type="button"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div
              aria-label="Canvas device"
              className="flex rounded-xl border border-white/10 bg-white/5 p-1"
              role="group"
            >
              {previewDevices.map((item) => (
                <button
                  aria-pressed={device === item.key}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    device === item.key
                      ? 'bg-white text-slate-950'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                  key={item.key}
                  onClick={() => setDevice(item.key)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <a
              className="text-xs font-black text-blue-300 hover:text-blue-200"
              href={previewStudioPath}
              target="_blank"
            >
              Open preview studio ↗
            </a>
          </div>
        </div>

        <div className="flex min-h-[42rem] justify-center overflow-auto bg-slate-200 p-3">
          <div
            className="h-[42rem] max-w-full shrink-0 overflow-hidden rounded-xl bg-white shadow-xl transition-[width]"
            style={{ width: selectedDevice.width }}
          >
            <iframe
              className="size-full border-0"
              key={`${device}-${refreshKey}`}
              onLoad={sendLatestPreview}
              ref={iframeRef}
              src={embeddedPreviewPath}
              title={`${selectedDevice.label} website draft preview`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-400">
          <span>
            {selectedDevice.label} · {hasUnsavedPreview ? 'unsaved preview' : 'saved draft'}
          </span>
          {selectedSection ? (
            <span className="rounded-full bg-blue-400/15 px-2.5 py-1 font-black text-blue-200">
              Editing {selectedSection}
            </span>
          ) : null}
          {siteStatus === 'published' && publicSlug ? (
            <a
              className="font-black text-blue-300 hover:text-blue-200"
              href={`/site/${publicSlug}`}
            >
              View live website
            </a>
          ) : (
            <span>Not published yet</span>
          )}
        </div>
      </div>
    </aside>
  );
}
