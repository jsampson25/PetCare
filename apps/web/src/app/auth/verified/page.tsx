import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';

export default function VerifiedPage() {
  return (
    <AuthCard
      footer={
        <Link className="font-bold underline" href="/app">
          Continue to PetCare
        </Link>
      }
      notice="Your email address is verified."
      title="Account verified"
    >
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        You can now continue securely into PetCare.
      </p>
    </AuthCard>
  );
}
