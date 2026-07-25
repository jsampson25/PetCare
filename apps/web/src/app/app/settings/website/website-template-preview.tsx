import type { WebsiteStyle, WebsiteTemplateLayout } from './website-theme-catalog';

export function WebsiteTemplatePreview({
  layout,
  style,
}: {
  layout: WebsiteTemplateLayout;
  style: WebsiteStyle;
}) {
  const palette = style.palette;
  const radius =
    style.key === 'warm' ? 'rounded-3xl' : style.key === 'classic' ? 'rounded-sm' : 'rounded-xl';

  return (
    <span
      className={`block aspect-[1.45] overflow-hidden border border-black/5 ${radius}`}
      style={{ backgroundColor: palette.canvas, color: palette.ink }}
    >
      <span className="flex h-[16%] items-center justify-between border-b border-black/5 bg-white/90 px-[6%]">
        <span className="flex items-center gap-2">
          <span
            className="grid size-7 place-items-center rounded-lg text-[0.55rem] font-black text-white"
            style={{ backgroundColor: palette.accent }}
          >
            R
          </span>
          <span className="h-2 w-16 rounded-full" style={{ backgroundColor: palette.ink }} />
        </span>
        <span className="flex items-center gap-3">
          <span className="h-1.5 w-8 rounded-full bg-slate-300" />
          <span className="h-1.5 w-8 rounded-full bg-slate-300" />
          <span className="h-6 w-14 rounded-full" style={{ backgroundColor: palette.accent }} />
        </span>
      </span>
      <span
        className={`grid h-[59%] gap-[7%] px-[7%] py-[6%] ${
          layout === 'split'
            ? 'grid-cols-[.9fr_1.1fr]'
            : layout === 'editorial'
              ? 'grid-cols-[1.15fr_.85fr]'
              : 'place-items-center text-center'
        }`}
      >
        <span className={layout === 'centered' ? 'grid justify-items-center' : ''}>
          <span
            className="block h-2 w-14 rounded-full opacity-60"
            style={{ backgroundColor: palette.accent }}
          />
          <span
            className="mt-3 block h-3 w-28 rounded-full"
            style={{ backgroundColor: palette.ink }}
          />
          <span
            className="mt-2 block h-2.5 w-24 rounded-full"
            style={{ backgroundColor: palette.ink }}
          />
          <span className="mt-3 block h-1.5 w-24 rounded-full bg-slate-300" />
          <span className="mt-1.5 block h-1.5 w-20 rounded-full bg-slate-300" />
          <span
            className="mt-4 block h-7 w-20 rounded-full"
            style={{ backgroundColor: palette.accent }}
          />
        </span>
        {layout !== 'centered' ? (
          <span
            className={`relative block overflow-hidden ${radius}`}
            style={{ background: `linear-gradient(145deg, ${palette.soft}, white)` }}
          >
            <span className="absolute bottom-0 left-[18%] size-20 rounded-t-full bg-white/80" />
            <span
              className="absolute bottom-6 left-[42%] size-12 rounded-full"
              style={{ backgroundColor: palette.accent, opacity: 0.28 }}
            />
          </span>
        ) : null}
      </span>
      <span className="grid h-[25%] grid-cols-3 gap-[3%] border-t border-black/5 bg-white/60 px-[7%] py-[4%]">
        {[0, 1, 2].map((item) => (
          <span className={`border border-black/5 bg-white ${radius}`} key={item}>
            <span
              className="mx-auto mt-3 block size-3 rounded-full"
              style={{ backgroundColor: palette.accent }}
            />
            <span className="mx-auto mt-2 block h-1.5 w-10 rounded-full bg-slate-300" />
          </span>
        ))}
      </span>
    </span>
  );
}
