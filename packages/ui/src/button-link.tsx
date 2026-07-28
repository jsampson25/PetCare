import type { ReactNode } from 'react';

type ButtonLinkProps = {
  children: ReactNode;
  href: string;
  leadingIcon?: ReactNode;
  variant?: 'primary' | 'secondary';
};

const styles = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-5 py-3 text-sm font-bold text-[var(--action-primary-text)] transition hover:bg-[var(--action-primary-hover)]',
  secondary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-default)] px-5 py-3 text-sm font-bold transition hover:bg-[var(--surface-subtle)]',
};

export function ButtonLink({ children, href, leadingIcon, variant = 'primary' }: ButtonLinkProps) {
  return (
    <a className={styles[variant]} href={href}>
      {leadingIcon}
      <span>{children}</span>
    </a>
  );
}
