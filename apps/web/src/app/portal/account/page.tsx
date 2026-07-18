import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { resolvePortalDashboard } from '../../../lib/auth/portal-context';
import { updatePortalProfile } from '../actions';
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export default async function AccountPage({ searchParams }: { searchParams: SearchParameters }) {
  const d = await resolvePortalDashboard();
  if (!d) return null;
  const p = await searchParams;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Profile & security</p>
        <h1 className="mt-2 text-3xl font-black">Account</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Maintain your safe contact fields and authentication settings.
        </p>
      </header>
      {typeof p.notice === 'string' ? (
        <Alert title="Account updated" tone="success">
          {p.notice}
        </Alert>
      ) : null}
      {typeof p.error === 'string' ? (
        <Alert title="Update unavailable" tone="danger">
          {p.error}
        </Alert>
      ) : null}
      <Card
        title={`${d.customer.first_name} ${d.customer.last_name}`}
        description={d.customer.email}
      >
        <form action={updatePortalProfile} className="grid gap-4 sm:grid-cols-2">
          <Field
            defaultValue={d.customer.preferred_name ?? ''}
            label="Preferred name"
            name="preferredName"
          />
          <Field defaultValue={d.customer.phone} label="Phone" name="phone" required />
          <div className="sm:col-span-2">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Card>
      <Card
        title="Security"
        description="Password changes use the authenticated recovery flow and revoke existing sessions."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/auth/forgot-password">Change password</ButtonLink>
          <ButtonLink href="/auth/sign-out" variant="secondary">
            Sign out
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
