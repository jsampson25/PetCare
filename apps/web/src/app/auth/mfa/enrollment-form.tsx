'use client';

import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Image from 'next/image';
import { useActionState } from 'react';

import { beginMfaEnrollment, type MfaEnrollmentState, verifyMfaCode } from './actions';

const initialState: MfaEnrollmentState = {};

export function MfaEnrollmentForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(beginMfaEnrollment, initialState);

  if (!state.factorId || !state.qrCode || !state.secret) {
    return (
      <form action={action} className="space-y-5">
        {state.error ? (
          <Alert title="Setup could not start" tone="danger">
            {state.error}
          </Alert>
        ) : null}
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Use an authenticator app such as Microsoft Authenticator, Google Authenticator, or
          1Password.
        </p>
        <Button loading={pending} type="submit">
          Set up authenticator
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6">Scan this QR code with your authenticator app.</p>
      <Image
        alt="Authenticator setup QR code"
        className="mx-auto rounded bg-white p-3"
        height={220}
        src={state.qrCode}
        unoptimized
        width={220}
      />
      <details className="text-sm">
        <summary className="cursor-pointer font-bold">Cannot scan the code?</summary>
        <p className="mt-2">Enter this setup key manually:</p>
        <code className="mt-2 block break-all rounded bg-[var(--surface-subtle)] p-3">
          {state.secret}
        </code>
      </details>
      <form action={verifyMfaCode} className="space-y-5">
        <input name="factorId" type="hidden" value={state.factorId} />
        <input name="next" type="hidden" value={next} />
        <Field
          autoComplete="one-time-code"
          inputMode="numeric"
          label="Six-digit code"
          maxLength={6}
          name="code"
          pattern="[0-9]{6}"
          required
        />
        <Button type="submit">Verify and continue</Button>
      </form>
    </div>
  );
}
