import { Button } from '@petcare/ui/button';
import Link from 'next/link';
import { InvitationExperience } from '../../../components/invitation-experience';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { acceptInvitation } from './actions';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: claims }] = await Promise.all([
    supabase.rpc('get_staff_invitation_preview', { invitation_token: token }),
    supabase.auth.getClaims(),
  ]);
  const preview = rows?.[0];
  if (!preview)
    return (
      <InvitationExperience eyebrow="Team access" title="Invitation unavailable">
        <p className="leading-7 text-[var(--text-secondary)]">
          This invitation is invalid, expired, revoked, or already used. Ask the business owner for
          a new invitation.
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
    <InvitationExperience eyebrow="Team invitation" title={`Join ${preview.business_name}`}>
      <p className="leading-7 text-[var(--text-secondary)]">
        Your team access is ready. Confirm the details below before accepting.
      </p>
      <dl className="mt-6 divide-y divide-[var(--border-default)] rounded-2xl border border-[var(--border-default)] px-5">
        {[
          ['Invited email', preview.invited_email],
          ['Role', preview.role_names.join(', ')],
          ['Location access', preview.location_names.join(', ')],
          [
            'Expires',
            new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(preview.expires_at),
            ),
          ],
        ].map(([label, value]) => (
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]" key={label}>
            <dt className="text-sm font-bold text-[var(--text-muted)]">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {signedIn ? (
        <form action={acceptInvitation} className="mt-6">
          <input name="token" type="hidden" value={token} />
          <Button className="w-full" type="submit">
            Accept team invitation
          </Button>
        </form>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--action-primary)] px-5 py-3 text-sm font-bold text-white"
            href={`/auth/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
          >
            Sign in to accept
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-5 py-3 text-sm font-bold"
            href={`/auth/register?next=${encodeURIComponent(`/invite/${token}`)}`}
          >
            Create account
          </Link>
        </div>
      )}
    </InvitationExperience>
  );
}
