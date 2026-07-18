import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  danger: 'bg-[var(--danger-strong)] text-white hover:bg-[var(--danger-foreground)]',
  primary:
    'bg-[var(--action-primary)] text-[var(--action-primary-text)] hover:bg-[var(--action-primary-hover)]',
  quiet: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]',
  secondary:
    'border border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]',
};

export function Button({
  children,
  className = '',
  disabled,
  loading = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      <span>{loading ? 'Working…' : children}</span>
    </button>
  );
}
