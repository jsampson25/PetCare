import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { AuthCard } from '../../../components/auth-card';
import { TenantAuthBrand } from '../../../components/tenant-auth-brand';
import { getTenantSlug, loadPublicTenantBrand } from '../../../lib/auth/public-tenant-brand';
import { getSafeRedirect } from '../../../lib/auth/safe-redirect';
import { signIn } from '../actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParameters }) {
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;
  const notice = typeof parameters.notice === 'string' ? parameters.notice : undefined;
  const next = getSafeRedirect(typeof parameters.next === 'string' ? parameters.next : undefined);
  const tenant = getTenantSlug(parameters.tenant);
  const tenantBrand = await loadPublicTenantBrand(tenant);
  const preservedQuery = new URLSearchParams({ next });
  if (tenant) preservedQuery.set('tenant', tenant);

  const content = (
    <AuthCard
      description="Welcome back. Sign in to continue to your secure workspace or customer portal."
      error={error}
      footer={
        <>
          <Link
            className="font-bold underline"
            href={`/auth/register?${preservedQuery.toString()}`}
          >
            Create an account
          </Link>
          <span className="mx-2">·</span>
          <Link className="font-bold underline" href="/auth/forgot-password">
            Forgot password?
          </Link>
        </>
      }
      notice={notice}
      title="Sign in"
    >
      {tenantBrand ? <TenantAuthBrand brand={tenantBrand} /> : null}
      <form action={signIn} className="space-y-5">
        <input name="next" type="hidden" value={next} />
        <input name="tenant" type="hidden" value={tenant} />
        <Field autoComplete="email" label="Email address" name="email" required type="email" />
        <Field
          autoComplete="current-password"
          label="Password"
          name="password"
          required
          type="password"
        />
        <Button className="w-full" type="submit">
          Sign in
        </Button>
      </form>
    </AuthCard>
  );

  return tenantBrand ? (
    <div
      style={
        {
          '--action-primary': tenantBrand.primary,
          '--action-primary-text': tenantBrand.primaryText,
          '--focus-ring': tenantBrand.primary,
          '--link-default': tenantBrand.primary,
        } as CSSProperties
      }
    >
      {content}
    </div>
  ) : (
    content
  );
}
