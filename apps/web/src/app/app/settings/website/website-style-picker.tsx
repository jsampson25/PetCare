import { WebsiteTemplatePreview } from './website-template-preview';
import type { WebsiteStyle, WebsiteTemplate } from './website-theme-catalog';

export function WebsiteStylePicker({
  style,
  template,
  isTrial,
}: {
  style: WebsiteStyle;
  template: WebsiteTemplate;
  isTrial: boolean;
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-base font-black text-[#0b1f3a]">Website theme</legend>
      <input name="theme" type="hidden" value={style.key} />
      <input name="template" type="hidden" value={template.key} />

      <div
        className={`mt-4 grid gap-5 rounded-2xl border p-4 lg:grid-cols-[minmax(0,22rem)_1fr] ${
          isTrial ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white'
        }`}
      >
        <WebsiteTemplatePreview layout={template.layout} style={style} />
        <div className="flex flex-col justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                {style.name} family
              </p>
              {isTrial ? (
                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-white">
                  Unsaved trial
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-slate-700">
                  Saved selection
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-black text-[#0b1f3a]">{template.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              {template.description}
            </p>
            {isTrial ? (
              <p className="mt-4 rounded-xl border border-blue-200 bg-white p-3 text-sm font-bold text-blue-950">
                This theme is loaded only in the editor. Review the preview, then select “Save
                website draft” to make it the saved draft theme.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700"
              href="/app/settings/website/themes"
            >
              Browse theme library
            </a>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-black text-[#0b1f3a] hover:border-blue-400 hover:bg-blue-50"
              href={`/theme-demo/${template.key}`}
              rel="noreferrer"
              target="_blank"
            >
              Open full demo ↗
            </a>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
