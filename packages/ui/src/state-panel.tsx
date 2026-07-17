import type { ReactNode } from 'react';

export function StatePanel({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-10 text-center">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg leading-7 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
