import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import Link from 'next/link';
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
      <main className="grid min-h-screen place-items-center p-4">
        <Card title="Invitation unavailable">
          <p>This link is invalid, expired, revoked, or already used.</p>
        </Card>
      </main>
    );
  const signedIn = Boolean(claims?.claims?.sub);
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-subtle)] p-4">
      <Card className="w-full max-w-lg" title={`Join ${preview.business_name}`}>
        <p className="text-[var(--text-secondary)]">
          Access the {preview.household_name} portal using {preview.invited_email}.
        </p>
        <p className="mt-3 text-sm">
          Expires{' '}
          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(preview.expires_at),
          )}
        </p>
        {signedIn ? (
          <form action={acceptPortalInvitation} className="mt-6">
            <input name="token" type="hidden" value={token} />
            <Button type="submit">Accept portal invitation</Button>
          </form>
        ) : (
          <div className="mt-6 flex gap-4">
            <Link
              className="font-bold underline"
              href={`/auth/sign-in?next=${encodeURIComponent(`/portal-invite/${token}`)}`}
            >
              Sign in
            </Link>
            <Link
              className="font-bold underline"
              href={`/auth/register?next=${encodeURIComponent(`/portal-invite/${token}`)}`}
            >
              Create account
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
