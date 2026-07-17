import type { ReactNode } from 'react';

type BadgeTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

const toneStyles: Record<BadgeTone, string> = {
  danger: 'border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger-foreground)]',
  info: 'border-[var(--info-border)] bg-[var(--info-background)] text-[var(--info-foreground)]',
  neutral: 'border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]',
  success: 'border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success-foreground)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning-foreground)]',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex rounded-[var(--radius-sm)] border px-2.5 py-1 text-xs font-bold ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}
