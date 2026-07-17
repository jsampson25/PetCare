import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  description?: string;
  title?: string;
};

export function Card({ children, className = '', description, title, ...props }: CardProps) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] p-6 shadow-[var(--elevation-1)] ${className}`}
      {...props}
    >
      {title ? <h2 className="text-lg font-bold tracking-tight">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
      <div className={title || description ? 'mt-5' : ''}>{children}</div>
    </section>
  );
}
