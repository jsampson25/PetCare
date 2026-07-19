import type { ReactNode } from 'react';

export function PortalPageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--action-primary)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">{description}</p>
      </div>
      {action}
    </header>
  );
}
