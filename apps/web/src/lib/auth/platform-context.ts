import { createSupabaseServerClient } from '../supabase/server';
import { resolveIdentityPresentation } from './identity-presentation';

export type PlatformContext = {
  accountEmail?: string;
  accountName: string;
  identityId: string;
  permissions: Set<string>;
  requiresMfa: boolean;
  roles: string[];
  sessionAssuranceLevel: string;
};
export async function resolvePlatformContext(): Promise<PlatformContext | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: claimsData }, { data }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.rpc('get_platform_context'),
  ]);
  if (!data) return null;
  const identityId = claimsData?.claims?.sub;
  if (typeof identityId !== 'string' || data.identity_id !== identityId) return null;
  const identity = resolveIdentityPresentation(claimsData?.claims);
  return {
    accountEmail: identity.email,
    accountName: identity.name,
    identityId,
    permissions: new Set(Array.isArray(data.permissions) ? data.permissions : []),
    requiresMfa: Boolean(data.requires_mfa),
    roles: Array.isArray(data.roles) ? data.roles : [],
    sessionAssuranceLevel:
      typeof claimsData?.claims?.aal === 'string' ? claimsData.claims.aal : 'aal1',
  };
}
