import type { ReactNode } from 'react';

type AlertTone = 'danger' | 'info' | 'success' | 'warning';

const toneStyles: Record<AlertTone, string> = {
  danger: 'border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger-foreground)]',
  info: 'border-[var(--info-border)] bg-[var(--info-background)] text-[var(--info-foreground)]',
  success: 'border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success-foreground)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning-foreground)]',
};

export function Alert({
  children,
  title,
  tone = 'info',
}: {
  children: ReactNode;
  title: string;
  tone?: AlertTone;
}) {
  return (
    <div className={`rounded-[var(--radius-md)] border p-4 ${toneStyles[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <p className="font-bold">{title}</p>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  );
}
