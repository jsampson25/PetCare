import { Alert } from '@petcare/ui/alert';
import { Card } from '@petcare/ui/card';
import type { ReactNode } from 'react';

type AuthCardProps = {
  children: ReactNode;
  description?: string;
  error?: string;
  footer?: ReactNode;
  notice?: string;
  title: string;
};

export function AuthCard({ children, description, error, footer, notice, title }: AuthCardProps) {
  return (
    <Card className="rounded-[1.75rem] border-[#dbe7f5] bg-white/95 p-6 shadow-[0_28px_80px_rgba(30,64,175,.12)] backdrop-blur sm:p-8">
      <h1 className="text-3xl font-semibold tracking-[-.04em] text-[#0b1f3a]">{title}</h1>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {error ? (
        <div className="mt-5">
          <Alert title="Unable to continue" tone="danger">
            {error}
          </Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-5">
          <Alert title="Next step" tone="success">
            {notice}
          </Alert>
        </div>
      ) : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 border-t border-[var(--border-default)] pt-5 text-sm">{footer}</div>
      ) : null}
    </Card>
  );
}
