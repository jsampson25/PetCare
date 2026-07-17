import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';
import { register } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  return (
    <AuthCard error={error} footer={<>Already registered? <Link className="font-bold underline" href="/auth/sign-in">Sign in</Link></>} title="Create your account">
      <form action={register} className="space-y-5">
        <Field autoComplete="name" label="Your name" name="displayName" required />
        <Field autoComplete="email" label="Email address" name="email" required type="email" />
        <Field autoComplete="new-password" hint="Use at least 12 characters." label="Password" minLength={12} name="password" required type="password" />
        <Field autoComplete="new-password" label="Confirm password" minLength={12} name="passwordConfirmation" required type="password" />
        <Button className="w-full" type="submit">Create account</Button>
      </form>
    </AuthCard>
  );
}
