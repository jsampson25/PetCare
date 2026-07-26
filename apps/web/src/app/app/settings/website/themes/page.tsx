import { ButtonLink } from '@petcare/ui/button-link';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { WebsiteTemplatePreview } from '../website-template-preview';
import { websiteStyles } from '../website-theme-catalog';

export default async function WebsiteThemeLibraryPage() {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');

  const supabase = await createSupabaseServerClient();
  const { data: site } = await supabase
    .from('tenant_websites')
    .select('theme_key,draft_content')
    .eq('business_id', context.businessId)
    .maybeSingle();

  const content = (site?.draft_content ?? {}) as Record<string, unknown>;
  const currentStyle = site?.theme_key ?? 'modern';
  const currentTemplate = String(content.template_key ?? 'studio-split');

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--action-primary)]">Customer website</p>
          <h1 className="mt-2 text-3xl font-black">Theme library</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
            Explore complete site compositions before applying one. Trying a theme never changes the
            saved draft until you return to the editor and confirm it.
          </p>
        </div>
        <ButtonLink href="/app/settings/website" variant="secondary">
          Back to website editor
        </ButtonLink>
      </header>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <p className="font-black">Content-safe theme switching</p>
        <p className="mt-1">
          Business copy, services, pages, and uploaded media stay in place. A theme changes the
          presentation, not the tenant&apos;s content or operational data.
        </p>
      </div>

      {websiteStyles.map((style) => (
        <section className="space-y-5" key={style.key}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-[#0b1f3a]">{style.name}</h2>
                {currentStyle === style.key ? (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                    Current family
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{style.description}</p>
            </div>
            <span className="flex gap-2" aria-label={`${style.name} color samples`}>
              {style.swatches.map((swatch) => (
                <span
                  className="size-8 rounded-full border border-black/10"
                  key={swatch}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </span>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {style.templates.map((template) => {
              const isCurrent = currentStyle === style.key && currentTemplate === template.key;
              return (
                <article
                  className={`overflow-hidden rounded-[1.5rem] border bg-white p-3 shadow-sm ${
                    isCurrent ? 'border-blue-600 ring-2 ring-blue-600/15' : 'border-slate-200'
                  }`}
                  key={template.key}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-3 rounded-2xl bg-slate-100 p-3">
                    <div>
                      <p className="mb-2 text-[0.65rem] font-black uppercase tracking-wide text-slate-500">
                        Desktop
                      </p>
                      <WebsiteTemplatePreview layout={template.layout} style={style} />
                    </div>
                    <div>
                      <p className="mb-2 text-center text-[0.65rem] font-black uppercase tracking-wide text-slate-500">
                        Mobile
                      </p>
                      <WebsiteTemplatePreview
                        device="mobile"
                        layout={template.layout}
                        style={style}
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-[#0b1f3a]">{template.name}</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                          {template.description}
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-blue-800">
                          Current
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">
                      Recommended for
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{template.bestFor}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {template.attributes.map((attribute) => (
                        <span
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                          key={attribute}
                        >
                          {attribute}
                        </span>
                      ))}
                    </div>

                    <details className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <summary className="cursor-pointer font-black">Included sections</summary>
                      <ul className="mt-2 grid gap-1 text-slate-600">
                        {template.includedSections.map((section) => (
                          <li key={section}>• {section}</li>
                        ))}
                      </ul>
                    </details>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <a
                        className="grid min-h-11 place-items-center rounded-xl border border-slate-300 px-3 text-sm font-black text-[#0b1f3a] hover:border-blue-400 hover:bg-blue-50"
                        href={`/theme-demo/${template.key}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Full demo ↗
                      </a>
                      <a
                        className="grid min-h-11 place-items-center rounded-xl bg-blue-600 px-3 text-center text-sm font-black text-white hover:bg-blue-700"
                        href={`/app/settings/website?theme=${style.key}&template=${template.key}&notice=Theme+loaded+for+review.+Save+the+draft+to+confirm.#draft-content`}
                      >
                        {isCurrent ? 'Review theme' : 'Try theme'}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
