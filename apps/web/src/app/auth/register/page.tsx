import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';
import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { register } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const next = getSafeRedirect(
    typeof parameters.next === 'string' ? parameters.next : undefined,
    '/auth/verified',
  );
  return (
    <AuthCard
      description="Create one secure account for reservations, pet profiles, care updates, and billing."
      error={error}
      footer={
        <>
          Already registered?{' '}
          <Link className="font-bold underline" href="/auth/sign-in">
            Sign in
          </Link>
        </>
      }
      title="Create your PetCare account"
    >
      <form action={register} className="space-y-5">
        <input name="next" type="hidden" value={next} />
        <Field autoComplete="name" label="Your name" name="displayName" required />
        <Field autoComplete="email" label="Email address" name="email" required type="email" />
        <Field
          autoComplete="new-password"
          hint="Use at least 12 characters."
          label="Password"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <Field
          autoComplete="new-password"
          label="Confirm password"
          minLength={12}
          name="passwordConfirmation"
          required
          type="password"
        />
        <Button className="w-full" type="submit">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
