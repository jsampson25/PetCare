# Database tests

SQL tests for constraints, row-level security, functions, and tenant isolation live here. Every tenant-scoped migration must add positive and negative isolation coverage.

Tests run inside transactions and roll back their fixtures. Identity tests use synthetic `example.test` addresses and fixed UUIDs; never copy production identities or customer data into fixtures.

The staff-invitation suite verifies token secrecy, recipient binding, single use, role and location validation, MFA step-up, tenant isolation, revocation, and audit evidence.

Invitation-preview tests verify default-deny behavior and the deliberately narrow anonymous execution grant.

Privileged-MFA tests prove the same owner receives no permission/location access at AAL1 and regains the expected grants only at AAL2.

Business-onboarding tests exercise tenant provisioning, profile persistence, a seven-day schedule, readiness calculation, audit evidence, and AAL1 denial.

Customer-window tests verify the seven-day arrival/pickup schedule, tenant-authorized saves, and rejection of windows outside regular operating hours.

Location-closure tests verify future-date validation, secure tenant-scoped removal, and persistence of customer communication context.
