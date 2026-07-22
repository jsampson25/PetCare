'use client';

import { Button } from '@petcare/ui/button';
import { useFormStatus } from 'react-dom';

export function RegistrationSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" loading={pending} loadingLabel="Creating account…" type="submit">
      Create account
    </Button>
  );
}
