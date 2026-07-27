import type { ReactNode } from 'react';

export function StatePanel({
  action,
  description,
  size = 'default',
  title,
}: {
  action?: ReactNode;
  description: string;
  size?: 'compact' | 'default';
  title: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] text-center ${size === 'compact' ? 'px-5 py-6' : 'px-6 py-10'}`}
    >
      <h2 className={`${size === 'compact' ? 'text-base' : 'text-lg'} font-bold`}>{title}</h2>
      <p className="mx-auto mt-2 max-w-lg leading-7 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
