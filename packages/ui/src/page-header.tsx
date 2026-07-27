import type { ReactNode } from 'react';

export function PageHeader({
  actions,
  className = '',
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow: string;
  title: ReactNode;
}) {
  return (
    <header
      className={`flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6 ${className}`}
    >
      <div className="min-w-0 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--action-primary)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 leading-7 text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
