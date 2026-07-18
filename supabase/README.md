# Supabase database

This directory is the executable source of truth for local Supabase configuration, PostgreSQL migrations, deterministic seed data, and database tests.

## Commands

```powershell
supabase start
supabase db reset
supabase test db
```

`supabase db reset` must be able to rebuild the local database from an empty state. Never repair a shared environment with an unversioned schema change.

## Current migration inventory

| Migration                                       | Ownership class                                                                      | RLS                                       | Purpose                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260717000100_identity_access_foundation.sql` | Platform-global identity/reference plus tenant and relationship-owned access records | Enabled and forced on every exposed table | Identity profiles, businesses, locations, memberships, predefined roles, permissions, location scopes, audit, protected tenant creation, and last-owner safety |

## Security conventions

- A business is the security tenant; locations are scopes inside that tenant.
- Tenant-owned records carry immutable `business_id` values.
- Cross-tenant relationships use composite foreign keys containing `business_id`.
- Browser/database API access is default-deny and relies on current relational membership, roles, and location scope.
- User-editable authentication metadata never grants roles, permissions, business access, or location scope.
- `security definer` functions have an empty search path, minimum execution grants, and dedicated adversarial tests.
- Audit records are append-only and exclude credentials, secrets, and unnecessary sensitive payloads.
- Service-role use requires a trusted server process and explicit tenant context; it is never a substitute for domain authorization.
