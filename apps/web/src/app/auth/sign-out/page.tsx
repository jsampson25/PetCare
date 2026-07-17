import { Button } from '@petcare/ui/button';
import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';
import { signOut } from '../actions';

export default function SignOutPage() {
  return (
    <AuthCard footer={<Link className="font-bold underline" href="/app">Cancel and return</Link>} title="Sign out">
      <p className="mb-5 text-sm leading-6 text-[var(--text-secondary)]">End this PetCare session on this device?</p>
      <form action={signOut}>
        <Button className="w-full" type="submit">Sign out</Button>
      </form>
    </AuthCard>
  );
}
