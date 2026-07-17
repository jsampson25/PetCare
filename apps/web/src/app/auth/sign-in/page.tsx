import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';
import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { signIn } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : undefined;
  const next = getSafeRedirect(typeof parameters.next === 'string' ? parameters.next : undefined);

  return (
    <AuthCard
      error={error}
      footer={<><Link className="font-bold underline" href="/auth/register">Create an account</Link><span className="mx-2">·</span><Link className="font-bold underline" href="/auth/forgot-password">Forgot password?</Link></>}
      notice={notice}
      title="Sign in"
    >
      <form action={signIn} className="space-y-5">
        <input name="next" type="hidden" value={next} />
        <Field autoComplete="email" label="Email address" name="email" required type="email" />
        <Field autoComplete="current-password" label="Password" name="password" required type="password" />
        <Button className="w-full" type="submit">Sign in</Button>
      </form>
    </AuthCard>
  );
}
