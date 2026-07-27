import type { ReactNode } from 'react';

export function RecordList({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={`divide-y divide-[var(--border-default)] ${className}`} role="list">
      {children}
    </ul>
  );
}

export function RecordListItem({
  action,
  description,
  leading,
  status,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="font-black text-[var(--text-primary)]">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
          ) : null}
        </div>
      </div>
      {status || action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {status}
          {action}
        </div>
      ) : null}
    </li>
  );
}
