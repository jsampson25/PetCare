import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';
import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { register } from '../actions';
import { PasswordField } from '../password-field';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const requestedPlan =
    typeof parameters.plan === 'string' && ['starter', 'growth', 'scale'].includes(parameters.plan)
      ? parameters.plan
      : 'growth';
  const startsWithTrial = parameters.trial === '14' && requestedPlan !== 'scale';
  const next = getSafeRedirect(
    typeof parameters.next === 'string' ? parameters.next : undefined,
    '/onboarding',
  );
  return (
    <AuthCard
      description={
        startsWithTrial
          ? `Create your owner account to begin a 14-day ${requestedPlan} trial. No credit card is required.`
          : 'Create your owner account, set up your pet-care business, and begin building its website.'
      }
      error={error}
      footer={
        <>
          Already registered?{' '}
          <Link className="font-bold underline" href="/auth/sign-in">
            Sign in
          </Link>
        </>
      }
      title={startsWithTrial ? 'Start your free trial' : 'Start your pet-care business'}
    >
      <form action={register} className="space-y-5">
        <input name="next" type="hidden" value={next} />
        <input name="plan" type="hidden" value={requestedPlan} />
        <input name="trial" type="hidden" value={startsWithTrial ? '14' : ''} />
        {startsWithTrial ? (
          <div className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e4f91]">
            <strong className="capitalize">{requestedPlan} plan</strong>
            <span className="mx-2 text-[#93b6df]">•</span>
            14 days free
            <span className="mx-2 text-[#93b6df]">•</span>
            No credit card
          </div>
        ) : null}
        <Field autoComplete="name" label="Your name" name="displayName" required />
        <Field autoComplete="email" label="Email address" name="email" required type="email" />
        <PasswordField />
        <PasswordField confirm />
        <label className="flex items-start gap-3 text-sm leading-6 text-[#52627a]">
          <input
            className="mt-1 size-4 shrink-0 accent-[#2563eb]"
            name="legalAccepted"
            required
            type="checkbox"
          />
          <span>
            I agree to the Roventra{' '}
            <Link className="font-bold text-[#1d4ed8] underline" href="/terms" target="_blank">
              Terms of Service
            </Link>{' '}
            and acknowledge the{' '}
            <Link className="font-bold text-[#1d4ed8] underline" href="/privacy" target="_blank">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <Button className="w-full" type="submit">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
