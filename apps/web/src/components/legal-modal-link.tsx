'use client';

import { useEffect, useId, useState } from 'react';

const titles = {
  '/cookies': 'Cookie Policy',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
} as const;

type LegalHref = keyof typeof titles;

export function LegalModalLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href: LegalHref;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <a
        className={className}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-[220] flex items-center justify-center bg-[#071a35]/65 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
          role="dialog"
        >
          <div className="flex h-[min(88vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#cbdcf4] bg-white shadow-[0_30px_100px_rgba(7,26,53,.35)]">
            <header className="flex items-center justify-between gap-4 border-b border-[#dbe7f5] px-5 py-4 sm:px-6">
              <h2 className="text-xl font-semibold tracking-[-.025em] text-[#0b1f3a]" id={titleId}>
                {titles[href]}
              </h2>
              <button
                aria-label={`Close ${titles[href]}`}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-[#cbdcf4] text-xl font-medium text-[#40516a] transition hover:bg-[#eef5ff] hover:text-[#0b1f3a]"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <iframe
              className="min-h-0 flex-1 bg-white"
              src={`${href}?embed=1`}
              title={titles[href]}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
