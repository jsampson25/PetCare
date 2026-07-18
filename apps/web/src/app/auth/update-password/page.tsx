import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';

import { AuthCard } from '../../../components/auth-card';
import { updatePassword } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  return (
    <AuthCard error={error} title="Choose a new password">
      <form action={updatePassword} className="space-y-5">
        <Field
          autoComplete="new-password"
          hint="Use at least 12 characters."
          label="New password"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <Field
          autoComplete="new-password"
          label="Confirm new password"
          minLength={12}
          name="passwordConfirmation"
          required
          type="password"
        />
        <Button className="w-full" type="submit">
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
