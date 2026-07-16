# Documentation Backlog

This backlog defines what documentation is needed and when. It prevents speculative volume while ensuring implementation is never forced to guess.

## Status legend

- `Not started`
- `In progress`
- `Review needed`
- `Accepted`
- `Deferred`

## Foundation backlog

| Artifact | Priority | Dependency | Status |
|---|---:|---|---|
| Product vision | P0 | None | Accepted |
| MVP scope | P0 | Product vision | Accepted |
| Glossary | P0 | Product vision | In progress |
| Master requirements index | P0 | MVP scope | Accepted |
| Requirements traceability model | P0 | Requirements index | Accepted |
| Information architecture | P0 | Personas, MVP scope | Not started |
| Role and permission model | P0 | IAM, portal scope | Not started |
| Multi-tenant security model | P0 | Architecture | Not started |
| Design system foundation | P0 | UX principles | Not started |
| Test strategy | P0 | Architecture, requirements | Not started |

## Domain specification backlog

| Sequence | Domain | MVP priority | Minimum required artifacts | Status |
|---:|---|---:|---|---|
| 1 | Business Configuration | P0 | Requirements, entities, workflows, permissions, rules, acceptance scenarios | In progress |
| 2 | Customer and Household | P0 | Same, plus portal access and consent | In progress |
| 3 | Pet and Eligibility | P0 | Same, plus vaccination and health data controls | Not started |
| 4 | Service Catalog | P0 | Service definition, add-ons, duration, eligibility, resource needs | Not started |
| 5 | Resource and Capacity | P0 | Capacity rules, resources, allocation, closures | Not started |
| 6 | Booking and Waitlist | P0 | Lifecycle, availability, waitlist, modifications, cancellation | Not started |
| 7 | Pricing and Policies | P0 | Calculation order, snapshots, deposits, fees, taxes | Not started |
| 8 | Payments and Invoicing | P0 | Payment lifecycle, refunds, reconciliation, webhooks | Not started |
| 9 | Operations | P0 | Check-in, service work, care tasks, check-out, audit timeline | Not started |
| 10 | Communications | P0 | Transactional messages, preferences, delivery events | Not started |
| 11 | Reporting | P0/P1 | MVP reports, definitions, filters, exports | Not started |
| 12 | Website and Content | P0/P1 | Tenant website, theme, pages, booking integration | Not started |
| 13 | Platform Administration | P0 | Tenant support, subscriptions, audit, feature controls | Not started |

## Implementation artifacts created only when a domain enters development

- Database schema and migrations
- Row-level security policies
- API contracts
- Event contracts
- Screen specifications
- Validation and error catalog
- Acceptance test suite
- Operational monitoring and runbook

## Review cadence

- Review the backlog before starting each domain.
- Mark documents accepted only after conflicts with related domains are resolved.
- Revisit MVP priority after each validated customer interview or pilot observation.
- Create implementation artifacts just before or during implementation, not months in advance.
