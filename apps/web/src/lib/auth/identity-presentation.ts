export type IdentityPresentation = {
  email?: string;
  name: string;
};

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function resolveIdentityPresentation(claims: unknown): IdentityPresentation {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    return { name: 'Signed-in user' };
  }
  const record = claims as Record<string, unknown>;
  const email = nonEmptyString(record.email);
  const metadata =
    record.user_metadata &&
    typeof record.user_metadata === 'object' &&
    !Array.isArray(record.user_metadata)
      ? (record.user_metadata as Record<string, unknown>)
      : {};
  const name =
    nonEmptyString(metadata.display_name) ??
    nonEmptyString(metadata.full_name) ??
    nonEmptyString(metadata.name) ??
    email?.split('@')[0] ??
    'Signed-in user';
  return { email, name };
}
