'use client';

import { useState } from 'react';

export function PasswordField({ confirm = false }: { confirm?: boolean }) {
  const [visible, setVisible] = useState(false);
  const id = confirm ? 'passwordConfirmation' : 'password';
  const label = confirm ? 'Confirm password' : 'Password';
  const descriptionId = confirm ? undefined : 'password-description';

  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      {!confirm ? (
        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]" id={descriptionId}>
          Use at least 10 characters.
        </p>
      ) : null}
      <div className="relative mt-2">
        <input
          aria-describedby={descriptionId}
          autoComplete="new-password"
          className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3 pr-20 text-base outline-none transition focus:border-[var(--focus-ring)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus-ring)_25%,transparent)]"
          id={id}
          minLength={10}
          name={id}
          required
          type={visible ? 'text' : 'password'}
        />
        <button
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          className="absolute inset-y-1 right-1 min-w-16 rounded-lg px-3 text-sm font-bold text-[#1d4ed8] transition hover:bg-[#eff6ff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563eb]"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
