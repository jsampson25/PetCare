import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title?: string;
  tone?: 'accent' | 'default' | 'subtle';
};

const toneStyles = {
  accent: 'border-blue-100 bg-[linear-gradient(135deg,#f2f7ff,#fff)]',
  default: 'border-[var(--border-default)] bg-[var(--surface-default)]',
  subtle: 'border-[var(--border-default)] bg-[var(--surface-subtle)]',
};

export function Card({
  actions,
  children,
  className = '',
  description,
  eyebrow,
  title,
  tone = 'default',
  ...props
}: CardProps) {
  const hasHeader = Boolean(actions || description || eyebrow || title);

  return (
    <section
      className={`rounded-[var(--radius-lg)] border p-6 shadow-[var(--elevation-1)] ${toneStyles[tone]} ${className}`}
      {...props}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            {eyebrow ? (
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--action-primary)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className={`${eyebrow ? 'mt-1' : ''} text-lg font-bold tracking-tight`}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={hasHeader ? 'mt-5' : ''}>{children}</div>
    </section>
  );
}
