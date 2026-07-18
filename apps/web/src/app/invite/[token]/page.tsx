import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import Link from 'next/link';

import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { acceptInvitation } from './actions';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: previewRows }, { data: claimsData }] = await Promise.all([
    supabase.rpc('get_staff_invitation_preview', { invitation_token: token }),
    supabase.auth.getClaims(),
  ]);
  const preview = previewRows?.[0];
  if (!preview) return <UnavailableInvitation />;
  const signedIn = Boolean(claimsData?.claims?.sub);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-subtle)] px-4 py-10">
      <Card className="w-full max-w-lg" title={`Join ${preview.business_name}`}>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-bold">Invited email</dt>
            <dd>{preview.invited_email}</dd>
          </div>
          <div>
            <dt className="font-bold">Role</dt>
            <dd>{preview.role_names.join(', ')}</dd>
          </div>
          <div>
            <dt className="font-bold">Location access</dt>
            <dd>{preview.location_names.join(', ')}</dd>
          </div>
          <div>
            <dt className="font-bold">Expires</dt>
            <dd>
              {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(preview.expires_at),
              )}
            </dd>
          </div>
        </dl>
        {signedIn ? (
          <form action={acceptInvitation} className="mt-6">
            <input name="token" type="hidden" value={token} />
            <Button type="submit">Accept invitation</Button>
          </form>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="font-bold underline"
              href={`/auth/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
            >
              Sign in to accept
            </Link>
            <Link
              className="font-bold underline"
              href={`/auth/register?next=${encodeURIComponent(`/invite/${token}`)}`}
            >
              Create an account
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}

function UnavailableInvitation() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-subtle)] px-4 py-10">
      <Card className="w-full max-w-lg" title="Invitation unavailable">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          This invitation is invalid, expired, revoked, or already used. Ask the business owner for
          a new invitation.
        </p>
        <Link className="mt-5 inline-block font-bold underline" href="/auth/sign-in">
          Go to sign in
        </Link>
      </Card>
    </main>
  );
}
