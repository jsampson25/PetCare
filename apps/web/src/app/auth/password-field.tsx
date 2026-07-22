'use client';

import { useState } from 'react';

const minimumLength = 10;

export function PasswordFields() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const passwordValid = password.length >= minimumLength;
  const passwordsMatch = confirmation.length > 0 && password === confirmation;

  return (
    <>
      <div>
        <label className="block text-sm font-bold" htmlFor="password">
          Password
        </label>
        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]" id="password-hint">
          Use at least 10 characters.
        </p>
        <div className="relative mt-2">
          <input
            aria-describedby="password-hint password-status"
            aria-invalid={passwordTouched && !passwordValid}
            autoComplete="new-password"
            className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3 pr-20 text-base outline-none transition focus:border-[var(--focus-ring)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus-ring)_25%,transparent)]"
            id="password"
            minLength={minimumLength}
            name="password"
            onBlur={() => setPasswordTouched(true)}
            onChange={(event) => setPassword(event.target.value)}
            required
            type={passwordVisible ? 'text' : 'password'}
            value={password}
          />
          <VisibilityButton
            label="password"
            onClick={() => setPasswordVisible((current) => !current)}
            visible={passwordVisible}
          />
        </div>
        {passwordTouched || password.length > 0 ? (
          <p
            aria-live="polite"
            className={`mt-2 text-sm font-bold ${passwordValid ? 'text-emerald-700' : 'text-red-700'}`}
            id="password-status"
          >
            {passwordValid
              ? '✓ Password length requirement met'
              : `Add ${minimumLength - password.length} more character${minimumLength - password.length === 1 ? '' : 's'}`}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-bold" htmlFor="passwordConfirmation">
          Confirm password
        </label>
        <div className="relative mt-2">
          <input
            aria-describedby="confirmation-status"
            aria-invalid={confirmationTouched && !passwordsMatch}
            autoComplete="new-password"
            className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3 pr-20 text-base outline-none transition focus:border-[var(--focus-ring)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus-ring)_25%,transparent)]"
            id="passwordConfirmation"
            minLength={minimumLength}
            name="passwordConfirmation"
            onBlur={() => setConfirmationTouched(true)}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            type={confirmationVisible ? 'text' : 'password'}
            value={confirmation}
          />
          <VisibilityButton
            label="confirmation password"
            onClick={() => setConfirmationVisible((current) => !current)}
            visible={confirmationVisible}
          />
        </div>
        {confirmationTouched || confirmation.length > 0 ? (
          <p
            aria-live="polite"
            className={`mt-2 text-sm font-bold ${passwordsMatch ? 'text-emerald-700' : 'text-red-700'}`}
            id="confirmation-status"
          >
            {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match yet'}
          </p>
        ) : null}
      </div>
    </>
  );
}

function VisibilityButton({
  label,
  onClick,
  visible,
}: {
  label: string;
  onClick: () => void;
  visible: boolean;
}) {
  return (
    <button
      aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
      className="absolute inset-y-1 right-1 min-w-16 rounded-lg px-3 text-sm font-bold text-[#1d4ed8] transition hover:bg-[#eff6ff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563eb]"
      onClick={onClick}
      type="button"
    >
      {visible ? 'Hide' : 'Show'}
    </button>
  );
}
