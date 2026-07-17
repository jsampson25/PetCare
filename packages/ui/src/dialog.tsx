'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from './button';

export function Dialog({
  children,
  description,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? 'dialog-description' : undefined}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-slate-950/45"
      onCancel={onClose}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold" id="dialog-title">{title}</h2>
            {description ? (
              <p className="mt-2 leading-6 text-[var(--text-secondary)]" id="dialog-description">
                {description}
              </p>
            ) : null}
          </div>
          <Button aria-label="Close dialog" onClick={onClose} variant="quiet">Close</Button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </dialog>
  );
}
