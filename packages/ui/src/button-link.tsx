import type { ReactNode } from 'react';

type ButtonLinkProps = {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary';
};

const styles = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--action-primary)] px-5 py-3 text-sm font-bold text-[var(--action-primary-text)] transition hover:bg-[var(--action-primary-hover)]',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-default)] px-5 py-3 text-sm font-bold transition hover:bg-[var(--surface-subtle)]',
};

export function ButtonLink({ children, href, variant = 'primary' }: ButtonLinkProps) {
  return (
    <a className={styles[variant]} href={href}>
      {children}
    </a>
  );
}
