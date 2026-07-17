'use client';

import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import { useActionState } from 'react';

import { inviteStaff, type InvitationFormState } from './actions';

const initialState: InvitationFormState = {};

export function InvitationForm({ roles }: { roles: { displayName: string; roleKey: string }[] }) {
  const [state, action, pending] = useActionState(inviteStaff, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Alert title="Invitation not created" tone="danger">{state.error}</Alert> : null}
      {state.invitationLink ? (
        <Alert title="Invitation created" tone="success">
          <p>Copy this one-time link and send it securely. Automated email delivery is added in a later milestone.</p>
          <input
            aria-label="Invitation link"
            className="mt-3 w-full rounded border border-current bg-transparent p-2 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={state.invitationLink}
          />
        </Alert>
      ) : null}
      <Field autoComplete="email" label="Staff email" name="email" required type="email" />
      <div>
        <label className="block text-sm font-bold" htmlFor="role">Role</label>
        <select className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3" id="role" name="role" required>
          <option value="">Choose a role</option>
          {roles.map((role) => <option key={role.roleKey} value={role.roleKey}>{role.displayName}</option>)}
        </select>
      </div>
      <Button loading={pending} type="submit">Create invitation</Button>
    </form>
  );
}
