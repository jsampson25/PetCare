# Migrations

Supabase CLI migrations are the authoritative database history. Generate migrations with the CLI, review the SQL and tenant-isolation impact, test from an empty local database, and commit them with the feature that needs them.

The E02 migrations introduce identity profiles, businesses, locations, memberships, predefined roles and permissions, location scope, audit history, staff invitations, and their row-level-security policies. Future tenant tables must follow the same immutable ownership and composite relationship pattern.

Staff invitations store only token digests, use bounded expiry, bind acceptance to the authenticated email, require MFA for privileged roles, and become unusable after acceptance, revocation, expiry, or supersession.

Invitation preview is a narrow token-bound RPC. It returns only the intended business, email, role, location labels, and expiry for a valid pending token; invalid and terminal tokens return no row.

Privileged MFA enforcement is part of the database authorization helpers. Memberships holding any role marked `requires_mfa` receive no permission or location grant until the current JWT has AAL2 assurance.
