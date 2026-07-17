import { ButtonLink } from '@petcare/ui/button-link';

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
};

export function PlaceholderPage({ eyebrow, title }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-20">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--action-primary)]">{eyebrow}</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight">{title}</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
          This route is reserved in the application shell and will be implemented in its scheduled
          MVP epic.
        </p>
        <div className="mt-8">
          <ButtonLink href="/" variant="secondary">
            Return home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
