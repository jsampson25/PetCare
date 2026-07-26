'use client';

import { useState } from 'react';

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const previewDevices: Array<{ key: PreviewDevice; label: string; width: string }> = [
  { key: 'desktop', label: 'Desktop', width: '100%' },
  { key: 'tablet', label: 'Tablet', width: '48rem' },
  { key: 'mobile', label: 'Mobile', width: '24.375rem' },
];

export function WebsiteEditorCanvas({
  publicSlug,
  siteStatus,
}: {
  publicSlug?: string | null;
  siteStatus: string;
}) {
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedDevice = previewDevices.find((item) => item.key === device) ?? previewDevices[0];

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
                Shows the last saved draft. Save changes, then refresh the canvas.
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
              href="/app/settings/website/preview"
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
              src="/app/settings/website/preview?frame=1"
              title={`${selectedDevice.label} saved website draft`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-400">
          <span>{selectedDevice.label} · private draft</span>
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
