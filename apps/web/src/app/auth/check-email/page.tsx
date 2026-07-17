import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckEmailPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : 'Check your email for the secure link.';
  return <AuthCard footer={<Link className="font-bold underline" href="/auth/sign-in">Return to sign in</Link>} notice={notice} title="Check your email"><p className="text-sm leading-6 text-[var(--text-secondary)]">For security, account details are not shown on this page.</p></AuthCard>;
}
