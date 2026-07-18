# ADR-0002: Use Business-Scoped Multi-Tenancy

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The SaaS serves multiple independent pet-care businesses. Each may operate one or more locations, and customers may have relationships with more than one business over time.

## Decision

Treat the subscribing business as the primary tenant. Business-owned records carry `business_id`; location-specific records also carry `location_id`. Enforce isolation through application authorization and PostgreSQL row-level security.

## Consequences

- Multi-location reporting is possible without weakening tenant isolation.
- Customers and pets require carefully designed relationships rather than global exposure across businesses.
- Background jobs, storage paths, search indexes, exports, logs, and AI retrieval must all preserve tenant context.

## Alternatives considered

- One database per business
- Location as the primary tenant
- Globally shared customer and pet records
