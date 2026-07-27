import type { ReactNode, SelectHTMLAttributes } from 'react';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  density?: 'compact' | 'default';
  error?: string;
  hint?: string;
  label: string;
};

export function SelectField({
  children,
  className = '',
  density = 'default',
  error,
  hint,
  id,
  label,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? props.name;
  if (!fieldId) throw new Error('SelectField requires an id or name.');
  const descriptionId = `${fieldId}-description`;

  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={fieldId}>
        {label}
      </label>
      {hint ? <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{hint}</p> : null}
      <select
        aria-describedby={hint || error ? descriptionId : undefined}
        aria-invalid={error ? true : undefined}
        className={`mt-2 w-full rounded-[var(--radius-md)] border bg-[var(--surface-default)] px-3 outline-none transition focus:border-[var(--focus-ring)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus-ring)_25%,transparent)] ${density === 'compact' ? 'min-h-11 text-sm' : 'min-h-12 text-base'} ${error ? 'border-[var(--danger-border)]' : 'border-[var(--border-strong)]'} ${className}`}
        id={fieldId}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p
          className="mt-2 text-sm font-semibold text-[var(--danger-foreground)]"
          id={descriptionId}
        >
          {error}
        </p>
      ) : hint ? (
        <span className="sr-only" id={descriptionId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
