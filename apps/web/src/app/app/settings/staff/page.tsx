import { Card } from '@petcare/ui/card';
import { Button } from '@petcare/ui/button';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { InvitationForm } from './invitation-form';
import { revokeInvitation } from './actions';

export default async function StaffSettingsPage() {
  const context = await resolveBusinessContext();
  if (!context) redirect('/auth/select-business');
  if (!context.permissions.has('staff.invite')) redirect('/denied');

  const supabase = await createSupabaseServerClient();
  const [{ data: roleRows }, { data: invitationRows }] = await Promise.all([
    supabase
      .from('role_definitions')
      .select('role_key,display_name')
      .neq('role_key', 'owner')
      .order('sort_order'),
    supabase
      .from('staff_invitations')
      .select('id,email,state,expires_at,created_at')
      .eq('business_id', context.businessId)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);
  const roles = (roleRows ?? []).map((role) => ({
    displayName: role.display_name,
    roleKey: role.role_key,
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--text-secondary)]">Settings</p>
        <h1 className="text-3xl font-black tracking-tight">Staff access</h1>
      </header>
      <Card
        description="Invitations expire after seven days and can be used only by the intended email address."
        title="Invite staff"
      >
        <InvitationForm roles={roles} />
      </Card>
      <Card description="Recent invitation status for this business." title="Invitations">
        {invitationRows?.length ? (
          <ul className="divide-y divide-[var(--border-default)]">
            {invitationRows.map((invitation) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 py-3"
                key={invitation.id}
              >
                <span className="font-semibold">{invitation.email}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm capitalize text-[var(--text-secondary)]">
                    {invitation.state}
                  </span>
                  {invitation.state === 'pending' ? (
                    <form action={revokeInvitation}>
                      <input name="invitationId" type="hidden" value={invitation.id} />
                      <Button type="submit" variant="quiet">
                        Revoke
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No invitations yet.</p>
        )}
      </Card>
    </div>
  );
}
