import { Button } from '@petcare/ui/button';
import Link from 'next/link';
import { InvitationExperience } from '../../../components/invitation-experience';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { acceptPortalInvitation } from './actions';

export default async function PortalInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: claims }] = await Promise.all([
    supabase.rpc('get_customer_portal_invitation_preview', { invitation_token: token }),
    supabase.auth.getClaims(),
  ]);
  const preview = rows?.[0];
  if (!preview)
    return (
      <InvitationExperience eyebrow="Customer portal" title="Invitation unavailable">
        <p className="leading-7 text-[var(--text-secondary)]">
          This link is invalid, expired, revoked, or already used. Ask the care team to send a new
          invitation.
        </p>
        <Link
          className="mt-6 inline-block font-black text-[var(--action-primary)]"
          href="/auth/sign-in"
        >
          Go to sign in →
        </Link>
      </InvitationExperience>
    );
  const signedIn = Boolean(claims?.claims?.sub);
  return (
    <InvitationExperience eyebrow="Your pet care home" title={`Join ${preview.business_name}`}>
      <p className="leading-7 text-[var(--text-secondary)]">
        You have been invited to securely manage the <strong>{preview.household_name}</strong>{' '}
        household using <strong>{preview.invited_email}</strong>.
      </p>
      <div className="mt-6 grid gap-3 rounded-2xl bg-[var(--surface-subtle)] p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
            Access
          </p>
          <p className="mt-1 font-bold">Pets & care</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
            Updates
          </p>
          <p className="mt-1 font-bold">Messages</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
            Valid until
          </p>
          <p className="mt-1 font-bold">
            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
              new Date(preview.expires_at),
            )}
          </p>
        </div>
      </div>
      {signedIn ? (
        <form action={acceptPortalInvitation} className="mt-6">
          <input name="token" type="hidden" value={token} />
          <Button className="w-full" type="submit">
            Accept portal invitation
          </Button>
        </form>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--action-primary)] px-5 py-3 text-sm font-bold text-white"
            href={`/auth/sign-in?next=${encodeURIComponent(`/portal-invite/${token}`)}`}
          >
            Sign in to accept
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-5 py-3 text-sm font-bold"
            href={`/auth/register?next=${encodeURIComponent(`/portal-invite/${token}`)}`}
          >
            Create account
          </Link>
        </div>
      )}
      <p className="mt-5 text-center text-xs leading-5 text-[var(--text-muted)]">
        For your security, this invitation can only be used once.
      </p>
    </InvitationExperience>
  );
}
