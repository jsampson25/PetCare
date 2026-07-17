# Database tests

SQL tests for constraints, row-level security, functions, and tenant isolation live here. Every tenant-scoped migration must add positive and negative isolation coverage.

Tests run inside transactions and roll back their fixtures. Identity tests use synthetic `example.test` addresses and fixed UUIDs; never copy production identities or customer data into fixtures.

The staff-invitation suite verifies token secrecy, recipient binding, single use, role and location validation, MFA step-up, tenant isolation, revocation, and audit evidence.
