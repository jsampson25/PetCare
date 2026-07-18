'use client';
import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { useActionState } from 'react';
import { inviteCustomerToPortal, type PortalInvitationState } from './actions';
const initial: PortalInvitationState = {};
export function PortalInvitationForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(inviteCustomerToPortal, initial);
  return (
    <form action={action} className="space-y-4">
      <input name="customerId" type="hidden" value={customerId} />
      {state.error ? (
        <Alert title="Invitation not created" tone="danger">
          {state.error}
        </Alert>
      ) : null}
      {state.invitationLink ? (
        <Alert title="Portal invitation created" tone="success">
          <p>Copy and send this single-use link securely.</p>
          <input
            aria-label="Portal invitation link"
            className="mt-3 w-full rounded border border-current bg-transparent p-2 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={state.invitationLink}
          />
        </Alert>
      ) : null}
      <Button loading={pending} type="submit">
        Create portal invitation
      </Button>
    </form>
  );
}
