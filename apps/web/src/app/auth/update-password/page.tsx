import { Button } from '@petcare/ui/button';

import { AuthCard } from '../../../components/auth-card';
import { updatePassword } from '../actions';
import { PasswordField } from '../password-field';

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
        <PasswordField />
        <PasswordField confirm />
        <Button className="w-full" type="submit">
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
