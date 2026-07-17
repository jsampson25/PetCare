import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';
import { requestPasswordReset } from '../actions';

export default function ForgotPasswordPage() {
  return (
    <AuthCard footer={<Link className="font-bold underline" href="/auth/sign-in">Return to sign in</Link>} title="Reset your password">
      <p className="mb-5 text-sm leading-6 text-[var(--text-secondary)]">Enter your email. We will send reset instructions if an account exists.</p>
      <form action={requestPasswordReset} className="space-y-5">
        <Field autoComplete="email" label="Email address" name="email" required type="email" />
        <Button className="w-full" type="submit">Send reset link</Button>
      </form>
    </AuthCard>
  );
}
