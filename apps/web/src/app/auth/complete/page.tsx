import Link from 'next/link';

import { AuthCard } from '../../../components/auth-card';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

const completionContent = {
  'email-change': {
    description: 'Your new email address is ready to use for future sign-ins.',
    notice: 'Your Roventra email address has been confirmed.',
    title: 'Email address confirmed',
  },
  invite: {
    description: 'Your invitation was accepted and your secure Roventra session is ready.',
    notice: 'You have successfully joined the Roventra workspace.',
    title: 'Invitation accepted',
  },
} as const;

export default async function AuthenticationCompletePage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const parameters = await searchParams;
  const action = typeof parameters.action === 'string' ? parameters.action : '';
  const content =
    completionContent[action as keyof typeof completionContent] ?? {
      description: 'The requested account action has been completed successfully.',
      notice: 'Your account information is up to date.',
      title: 'Confirmation complete',
    };

  return (
    <AuthCard
      description={content.description}
      notice={content.notice}
      title={content.title}
    >
      <Link
        className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--action-primary)] px-5 py-2.5 text-sm font-bold text-[var(--action-primary-text)] transition hover:bg-[var(--action-primary-hover)] active:translate-y-px active:scale-[0.99]"
        href="/auth/select-business"
      >
        Continue to Roventra
      </Link>
    </AuthCard>
  );
}
