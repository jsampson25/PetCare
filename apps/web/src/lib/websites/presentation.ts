export type WebsiteThemeKey = 'modern' | 'warm' | 'classic';

type LayoutKey = 'split' | 'centered' | 'editorial';

const templateLayouts: Record<string, LayoutKey> = {
  'studio-split': 'split',
  'centered-studio': 'centered',
  'modern-editorial': 'editorial',
  'happy-tails': 'split',
  'pet-parade': 'editorial',
  neighborhood: 'centered',
  heritage: 'split',
  lodge: 'centered',
  professional: 'editorial',
};

const themePresentation = {
  modern: {
    about: 'rounded-[2rem] bg-[#0b1f3a] text-white shadow-[0_30px_80px_rgba(11,31,58,.16)]',
    aboutEyebrow: 'text-blue-200',
    aboutItem: 'border-white/15 bg-white/5',
    aboutMuted: 'text-blue-50/80',
    canvas: 'bg-[#f7faff] text-[#0b1f3a]',
    card: 'rounded-2xl border border-[#d7e4f5] bg-white shadow-sm',
    eyebrow: 'tracking-[0.22em]',
    font: 'font-sans',
    heading: 'tracking-[-0.055em]',
    image: 'rounded-[2rem]',
    section: 'py-20 sm:py-24',
  },
  warm: {
    about: 'rounded-[3rem] bg-[#fff0dc] text-[#42210f] shadow-[0_26px_70px_rgba(154,78,25,.12)]',
    aboutEyebrow: 'text-[#b54e12]',
    aboutItem: 'border-[#eec89f] bg-white/55',
    aboutMuted: 'text-[#6f4127]',
    canvas: 'bg-[#fffaf3] text-[#3d2114]',
    card: 'rounded-[2rem] border-2 border-[#f5d7b4] bg-white shadow-[0_12px_0_rgba(249,115,22,.10)]',
    eyebrow: 'tracking-[0.16em]',
    font: 'font-sans',
    heading: 'tracking-[-0.04em]',
    image: 'rounded-[3rem]',
    section: 'py-16 sm:py-20',
  },
  classic: {
    about: 'rounded-sm border border-[#d9cfbd] bg-[#233f35] text-white shadow-lg',
    aboutEyebrow: 'text-[#d8cdb7]',
    aboutItem: 'border-white/15 bg-white/5',
    aboutMuted: 'text-[#f3ede2]/80',
    canvas: 'bg-[#fbfaf6] text-[#24372f]',
    card: 'rounded-sm border border-[#d9cfbd] bg-[#fffefb] shadow-sm',
    eyebrow: 'tracking-[0.14em]',
    font: 'font-serif',
    heading: 'tracking-[-0.025em]',
    image: 'rounded-sm',
    section: 'py-20 sm:py-24',
  },
} satisfies Record<WebsiteThemeKey, Record<string, string>>;

const templateDetails: Record<
  string,
  {
    aboutGrid: string;
    heroGrid: string;
    heroImage: string;
    heroText: string;
    serviceGrid: string;
  }
> = {
  'studio-split': {
    aboutGrid: 'lg:grid-cols-[.8fr_1.2fr]',
    heroGrid: 'lg:grid-cols-[1.05fr_.95fr] lg:items-center',
    heroImage: '',
    heroText: '',
    serviceGrid: 'md:grid-cols-3',
  },
  'centered-studio': {
    aboutGrid: 'lg:grid-cols-2',
    heroGrid: 'text-center',
    heroImage: 'mx-auto mt-14 max-w-5xl',
    heroText: 'mx-auto max-w-4xl',
    serviceGrid: 'md:grid-cols-3',
  },
  'modern-editorial': {
    aboutGrid: 'lg:grid-cols-[1.15fr_.85fr]',
    heroGrid: 'lg:grid-cols-[.9fr_1.1fr] lg:items-end',
    heroImage: 'lg:order-first',
    heroText: 'lg:pb-10',
    serviceGrid: 'md:grid-cols-2',
  },
  'happy-tails': {
    aboutGrid: 'lg:grid-cols-[.9fr_1.1fr]',
    heroGrid: 'lg:grid-cols-[.9fr_1.1fr] lg:items-center',
    heroImage: 'lg:rotate-1',
    heroText: '',
    serviceGrid: 'md:grid-cols-3',
  },
  'pet-parade': {
    aboutGrid: 'lg:grid-cols-[1.2fr_.8fr]',
    heroGrid: 'lg:grid-cols-[1.1fr_.9fr] lg:items-end',
    heroImage: 'lg:order-first lg:-rotate-1',
    heroText: 'lg:pb-12',
    serviceGrid: 'md:grid-cols-2',
  },
  neighborhood: {
    aboutGrid: 'lg:grid-cols-2',
    heroGrid: 'text-center',
    heroImage: 'mx-auto mt-12 max-w-6xl',
    heroText: 'mx-auto max-w-4xl',
    serviceGrid: 'md:grid-cols-3',
  },
  heritage: {
    aboutGrid: 'lg:grid-cols-[.75fr_1.25fr]',
    heroGrid: 'lg:grid-cols-[1fr_1fr] lg:items-center',
    heroImage: '',
    heroText: '',
    serviceGrid: 'md:grid-cols-3',
  },
  lodge: {
    aboutGrid: 'lg:grid-cols-[1.1fr_.9fr]',
    heroGrid: 'text-center',
    heroImage: 'mx-auto mt-14 max-w-5xl',
    heroText: 'mx-auto max-w-4xl',
    serviceGrid: 'md:grid-cols-3',
  },
  professional: {
    aboutGrid: 'lg:grid-cols-[1fr_1fr]',
    heroGrid: 'lg:grid-cols-[.82fr_1.18fr] lg:items-center',
    heroImage: 'lg:order-first',
    heroText: '',
    serviceGrid: 'md:grid-cols-2',
  },
};

export function getWebsitePresentation(theme: WebsiteThemeKey, templateKey: string) {
  const safeTheme = themePresentation[theme] ?? themePresentation.modern;
  const layout = templateLayouts[templateKey] ?? 'split';
  const template = templateDetails[templateKey] ?? templateDetails['studio-split'];

  return {
    ...safeTheme,
    ...template,
    centered: layout === 'centered',
    editorial: layout === 'editorial',
    layout,
  };
}
