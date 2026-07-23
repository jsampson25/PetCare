-- Tenant MFA is recommended and available from Security settings, but is not
-- required by default. Platform operator roles continue to require MFA.

update public.role_definitions
set requires_mfa = false
where role_key in (
  'owner',
  'manager',
  'front_desk',
  'care_staff',
  'groomer',
  'accountant',
  'marketing_editor',
  'read_only_auditor'
);
