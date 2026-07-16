# Master Requirements Index

This index controls the platform requirements. It converts product intent into uniquely identified, testable requirements that can be traced to designs, code, and verification.

## Requirement identifiers

Use the format `DOMAIN-TYPE-NNN`.

| Segment | Meaning | Examples |
|---|---|---|
| Domain | Stable domain abbreviation | `BCFG`, `CUST`, `PET`, `BOOK`, `PRICE`, `PAY`, `OPS` |
| Type | Requirement category | `FR` functional, `BR` business rule, `NFR` non-functional, `SEC` security, `DATA` data |
| Number | Three-digit sequence within the domain and type | `001`, `002` |

Example: `BOOK-BR-014` identifies Booking business rule 14.

Identifiers are never reused. Retired requirements remain recorded with status `Retired` and a replacement link when applicable.

## Requirement lifecycle

```text
Proposed → Accepted → Designed → Implemented → Verified
                ↘ Deferred
                ↘ Retired
```

## Priority definitions

| Priority | Meaning |
|---|---|
| P0 | Required for the MVP to operate safely or deliver its core value. |
| P1 | Important shortly after MVP or necessary for strong market competitiveness. |
| P2 | Valuable enhancement that does not block launch. |
| Future | Deliberately outside the current planning horizon. |

## Domain register

| Domain | Prefix | MVP importance | Specification | Status |
|---|---|---:|---|---|
| Business Configuration | BCFG | P0 | [Specification](../domains/business-configuration/README.md) | In progress |
| Identity and Access | IAM | P0 | Planned | Not started |
| Customer and Household | CUST | P0 | Planned | Not started |
| Pet and Eligibility | PET | P0 | Planned | Not started |
| Service Catalog | SERV | P0 | Planned | Not started |
| Resource and Capacity | CAP | P0 | Planned | Not started |
| Booking and Waitlist | BOOK | P0 | Planned | Not started |
| Pricing and Policies | PRICE | P0 | Planned | Not started |
| Payments and Invoicing | PAY | P0 | Planned | Not started |
| Operations | OPS | P0 | Planned | Not started |
| Communications | COMM | P0 | Planned | Not started |
| Reporting | RPT | P0/P1 | Planned | Not started |
| Website and Content | WEB | P0/P1 | Planned | Not started |
| Platform Administration | ADMIN | P0 | Planned | Not started |
| AI Assistance | AI | Future | Planned | Deferred |

## Cross-cutting requirement areas

- Multi-tenant isolation
- Role-based authorization
- Auditability
- Accessibility
- Responsive behavior
- Privacy and data retention
- Performance and availability
- External integration reliability
- Observability
- Testability

## Definition of a usable requirement

A requirement must be:

- Specific enough to implement
- Observable or testable
- Assigned to one owning domain
- Prioritized
- Free of unnecessary implementation assumptions
- Linked to relevant business rules and acceptance scenarios

