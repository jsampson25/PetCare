import { cookies } from 'next/headers';

import { createSupabaseServerClient } from '../supabase/server';

export const businessContextCookie = 'petcare-business-context';

export type BusinessContext = {
  businessId: string;
  businessName: string;
  identityId: string;
  membershipId: string;
  permissions: Set<string>;
  requiresMfa: boolean;
  roles: string[];
  sessionAssuranceLevel: string;
};

export async function listBusinessContexts() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const identityId = claimsData?.claims?.sub;
  if (typeof identityId !== 'string') return [];

  const { data: memberships, error } = await supabase
    .from('business_memberships')
    .select('id,business_id')
    .eq('identity_id', identityId)
    .eq('state', 'active');
  if (error || !memberships?.length) return [];

  const businessIds = memberships.map((membership) => membership.business_id);
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id,name')
    .in('id', businessIds)
    .in('status', ['draft', 'active']);
  const names = new Map((businesses ?? []).map((business) => [business.id, business.name]));

  return memberships
    .filter((membership) => names.has(membership.business_id))
    .map((membership) => ({
      businessId: membership.business_id,
      businessName: names.get(membership.business_id) ?? 'Business',
      membershipId: membership.id,
    }))
    .sort((left, right) => left.businessName.localeCompare(right.businessName));
}

export async function resolveBusinessContext(): Promise<BusinessContext | null> {
  const cookieStore = await cookies();
  const businessId = cookieStore.get(businessContextCookie)?.value;
  if (!businessId) return null;

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const identityId = claimsData?.claims?.sub;
  if (typeof identityId !== 'string') return null;

  const { data: membership } = await supabase
    .from('business_memberships')
    .select('id,business_id')
    .eq('business_id', businessId)
    .eq('identity_id', identityId)
    .eq('state', 'active')
    .maybeSingle();
  if (!membership) return null;

  const [{ data: business }, { data: roleAssignments }] = await Promise.all([
    supabase.from('businesses').select('id,name').eq('id', businessId).maybeSingle(),
    supabase
      .from('membership_roles')
      .select('role_key')
      .eq('business_id', businessId)
      .eq('membership_id', membership.id),
  ]);
  if (!business) return null;

  const roles = (roleAssignments ?? []).map((assignment) => assignment.role_key);
  const sessionAssuranceLevel =
    typeof claimsData?.claims?.aal === 'string' ? claimsData.claims.aal : 'aal1';
  let permissionAssignments: { permission_key: string }[] = [];
  let roleDefinitions: { requires_mfa: boolean; role_key: string }[] = [];
  if (roles.length) {
    const [permissionResult, roleResult] = await Promise.all([
      supabase.from('role_permissions').select('permission_key').in('role_key', roles),
      supabase.from('role_definitions').select('role_key,requires_mfa').in('role_key', roles),
    ]);
    permissionAssignments = permissionResult.data ?? [];
    roleDefinitions = roleResult.data ?? [];
  }

  return {
    businessId,
    businessName: business.name,
    identityId,
    membershipId: membership.id,
    permissions: new Set((permissionAssignments ?? []).map((entry) => entry.permission_key)),
    requiresMfa: (roleDefinitions ?? []).some((role) => role.requires_mfa),
    roles,
    sessionAssuranceLevel,
  };
}
