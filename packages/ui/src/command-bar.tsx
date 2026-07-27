import type { ReactNode } from 'react';

export function CommandBar({
  children,
  className = '',
  description,
  secondaryAction,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  secondaryAction?: ReactNode;
  title: string;
}) {
  return (
    <section
      aria-label={`${title} controls`}
      className={`rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-5 shadow-[var(--elevation-1)] ${className}`}
    >
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--action-primary)]">
          View controls
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
      {secondaryAction ? (
        <div className="mt-4 border-t border-[var(--border-default)] pt-4">{secondaryAction}</div>
      ) : null}
    </section>
  );
}
