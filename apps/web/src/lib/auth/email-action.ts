export type SupportedEmailAction =
  | 'email'
  | 'email_change'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'signup';

const emailActionDestinations: Record<SupportedEmailAction, string> = {
  email: '/auth/verified',
  email_change: '/auth/complete?action=email-change',
  invite: '/auth/complete?action=invite',
  magiclink: '/auth/select-business',
  recovery: '/auth/update-password',
  signup: '/auth/verified',
};

export function getEmailActionRedirect(type: string | null) {
  if (!type || !(type in emailActionDestinations)) return '/app';
  return emailActionDestinations[type as SupportedEmailAction];
}
