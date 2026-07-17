import { Alert } from '@petcare/ui/alert';
import { Card } from '@petcare/ui/card';
import type { ReactNode } from 'react';

type AuthCardProps = {
  children: ReactNode;
  error?: string;
  footer?: ReactNode;
  notice?: string;
  title: string;
};

export function AuthCard({ children, error, footer, notice, title }: AuthCardProps) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      {error ? <div className="mt-5"><Alert title="Unable to continue" tone="danger">{error}</Alert></div> : null}
      {notice ? <div className="mt-5"><Alert title="Next step" tone="success">{notice}</Alert></div> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-[var(--border-default)] pt-5 text-sm">{footer}</div> : null}
    </Card>
  );
}
