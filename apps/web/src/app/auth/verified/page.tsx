import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';

export default function VerifiedPage() {
  return (
    <AuthCard
      footer={
        <Link className="font-bold underline" href="/onboarding">
          Set up your business
        </Link>
      }
      notice="Your email address is verified."
      title="Account verified"
    >
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        Next, create your business and choose the web address customers will use.
      </p>
    </AuthCard>
  );
}
