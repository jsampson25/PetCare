import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { PortalPageHeader } from '../_components/portal-page-header';
import { updatePortalProfile } from '../actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function AccountPage({ searchParams }: { searchParams: SearchParameters }) {
  const dashboard = await resolvePortalDashboard();
  if (!dashboard) return null;
  const parameters = await searchParams;
  return (
    <div className="space-y-6">
      <PortalPageHeader
        description="Keep your contact details current and manage how you securely access the portal."
        eyebrow="Profile & security"
        title="Your account"
      />
      {typeof parameters.notice === 'string' ? (
        <Alert title="Account updated" tone="success">
          {parameters.notice}
        </Alert>
      ) : null}
      {typeof parameters.error === 'string' ? (
        <Alert title="Update unavailable" tone="danger">
          {parameters.error}
        </Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <Card title="Contact details" description="Used for reservation and care communication.">
          <div className="mb-6 flex items-center gap-4 rounded-xl bg-[var(--surface-subtle)] p-4">
            <span
              className="grid size-12 place-items-center rounded-full bg-[var(--action-primary)] font-black text-white"
              aria-hidden="true"
            >
              {dashboard.customer.first_name[0]}
              {dashboard.customer.last_name[0]}
            </span>
            <div>
              <p className="font-black">
                {dashboard.customer.first_name} {dashboard.customer.last_name}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{dashboard.customer.email}</p>
            </div>
          </div>
          <form action={updatePortalProfile} className="grid gap-4 sm:grid-cols-2">
            <Field
              defaultValue={dashboard.customer.preferred_name ?? ''}
              label="Preferred name"
              name="preferredName"
            />
            <Field defaultValue={dashboard.customer.phone} label="Phone" name="phone" required />
            <div className="sm:col-span-2">
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </Card>
        <div className="space-y-5">
          <Card
            title="Security"
            description="Password changes use the authenticated recovery flow and revoke existing sessions."
          >
            <div className="grid gap-3">
              <div className="rounded-xl border border-[var(--border-default)] p-4">
                <p className="font-bold">Password</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Choose a unique password you do not use elsewhere.
                </p>
              </div>
              <ButtonLink href="/auth/forgot-password">Change password</ButtonLink>
              <ButtonLink href="/auth/sign-out" variant="secondary">
                Sign out
              </ButtonLink>
            </div>
          </Card>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--action-primary)]">
              Household
            </p>
            <p className="mt-2 font-black">{dashboard.household.display_name}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Pet and reservation access is scoped to this household.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
