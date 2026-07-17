import type { ReactNode } from 'react';

type ButtonLinkProps = {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary';
};

const styles = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-strong)]',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-bold transition hover:bg-[var(--accent)]',
};

export function ButtonLink({ children, href, variant = 'primary' }: ButtonLinkProps) {
  return (
    <a className={styles[variant]} href={href}>
      {children}
    </a>
  );
}
