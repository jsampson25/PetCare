# Migrations

Supabase CLI migrations are the authoritative database history. Generate migrations with the CLI, review the SQL and tenant-isolation impact, test from an empty local database, and commit them with the feature that needs them.

The first migration introduces identity profiles, businesses, locations, memberships, predefined roles and permissions, location scope, audit history, and their row-level-security policies together. Future tenant tables must follow the same immutable ownership and composite relationship pattern.
