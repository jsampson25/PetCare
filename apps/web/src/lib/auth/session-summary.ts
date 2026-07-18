export type SessionSummary = {
  assurance: 'MFA verified' | 'Password verified';
  expiresAt?: Date;
  issuedAt?: Date;
};

function numericDate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  const date = new Date(value * 1000);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function getSessionSummary(claims: Record<string, unknown>): SessionSummary {
  return {
    assurance: claims.aal === 'aal2' ? 'MFA verified' : 'Password verified',
    expiresAt: numericDate(claims.exp),
    issuedAt: numericDate(claims.iat),
  };
}
