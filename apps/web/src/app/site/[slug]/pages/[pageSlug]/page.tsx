import { ButtonLink } from '@petcare/ui/button-link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

type CustomPage = {
  id: string;
  title: string;
  slug: string;
  body: string;
  showInNavigation: boolean;
};

type Site = {
  business: { name: string; slug: string };
  theme_key: 'modern' | 'warm' | 'classic';
  brand_tokens: { primary: string; accent: string };
  content: { custom_pages?: CustomPage[] };
};

async function getPage(slug: string, pageSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_public_tenant_website', { public_slug_value: slug });
  const site = data as Site | null;
  const page = site?.content.custom_pages?.find((candidate) => candidate.slug === pageSlug);
  return site && page ? { site, page } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const result = await getPage(slug, pageSlug);
  return result
    ? { title: `${result.page.title} | ${result.site.business.name}` }
    : { title: 'Page unavailable', robots: { index: false, follow: false } };
}

export default async function TenantCustomPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const result = await getPage(slug, pageSlug);
  if (!result) notFound();
  const { site, page } = result;
  const centeredHeader = site.theme_key === 'modern';

  return (
    <main
      className="min-h-screen bg-[#fbfcfa] text-[#17211b]"
      style={
        {
          '--tenant-primary': site.brand_tokens.primary,
          '--tenant-accent': site.brand_tokens.accent,
          '--action-primary': site.brand_tokens.primary,
        } as CSSProperties
      }
    >
      <header className="border-b bg-white">
        <div
          className={`mx-auto max-w-6xl gap-6 px-6 py-4 ${
            centeredHeader
              ? 'flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]'
              : 'flex min-h-20 items-center justify-between'
          }`}
        >
          {centeredHeader ? (
            <a className="hidden font-bold md:block" href={`/site/${site.business.slug}`}>
              Home
            </a>
          ) : null}
          <a
            className={`flex items-center gap-3 font-black ${centeredHeader ? 'flex-col gap-1 text-center' : ''}`}
            href={`/site/${site.business.slug}`}
          >
            <span
              className="grid size-10 place-items-center rounded-2xl text-xs text-white"
              style={{ background: 'var(--tenant-primary)' }}
            >
              HP
            </span>
            <span>
              <span className="block">{site.business.name}</span>
              {centeredHeader ? (
                <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Boarding · Daycare · Grooming
                </span>
              ) : null}
            </span>
          </a>
          <div className="flex justify-end gap-3">
            {!centeredHeader ? (
              <ButtonLink href={`/site/${site.business.slug}`} variant="secondary">
                Back to website
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/book?tenant=${site.business.slug}`}>Book now</ButtonLink>
          </div>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p
          className="text-xs font-black uppercase tracking-[0.2em]"
          style={{ color: 'var(--tenant-primary)' }}
        >
          {site.business.name}
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{page.title}</h1>
        <div className="mt-10 whitespace-pre-wrap text-lg leading-8 text-slate-600">
          {page.body}
        </div>
      </article>
    </main>
  );
}
