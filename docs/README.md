# Documentation Index

This directory is the source of truth for the product and its implementation. Earlier exported ZIP packages are reference snapshots only; authoritative decisions belong here.

## Foundation

- [Product vision](product/product-vision.md)
- [MVP scope](product/mvp-scope.md)
- [MVP implementation roadmap](product/mvp-implementation-roadmap.md)
- [Glossary](product/glossary.md)
- [Terminology consistency audit](product/terminology-audit.md)
- [Master requirements index](requirements/README.md)
- [Documentation backlog](requirements/documentation-backlog.md)
- [Requirements traceability](requirements/traceability.md)
- [Architecture overview](architecture/overview.md)
- [Technology stack](architecture/technology-stack.md)
- [Multi-tenant security model](architecture/multi-tenant-security.md)
- [Quality documentation](quality/README.md)
- [Platform test strategy](quality/test-strategy.md)
- [Architecture decisions](decisions/README.md)
- [UX documentation](ux/README.md)
- [Information architecture and navigation](ux/information-architecture.md)
- [Design system foundation](ux/design-system.md)
- [Customer booking journey](ux/customer-booking-journey.md)
- [Check-in and checkout journey](ux/check-in-checkout-journey.md)
- [Daily care and service-execution journey](ux/daily-care-service-execution-journey.md)
- [Business onboarding journey](ux/business-onboarding-journey.md)
- [Responsive and accessibility interaction standards](ux/responsive-accessibility-standards.md)
- [Role and permission presentation model](ux/role-permission-presentation-model.md)

## Domain specifications

- [Business Configuration](domains/business-configuration/README.md)
- [Identity and Access](domains/identity-access/README.md)
- [Customer and Household](domains/customer-household/README.md)
- [Pet and Eligibility](domains/pet-eligibility/README.md)
- [Service Catalog](domains/service-catalog/README.md)
- [Resource and Capacity](domains/resource-capacity/README.md)
- [Booking and Waitlist](domains/booking-waitlist/README.md)
- [Pricing and Policies](domains/pricing-policies/README.md)
- [Payments and Invoicing](domains/payments-invoicing/README.md)
- [Operations](domains/operations/README.md)
- [Communications](domains/communications/README.md)
- [Reporting](domains/reporting/README.md)
- [Website and Content](domains/website-content/README.md)
- [Platform Administration](domains/platform-administration/README.md)

## Planned documentation areas

- `product/` — vision, users, scope, roadmap, terminology, and success measures
- `architecture/` — system boundaries, tenancy, security, data, integrations, and deployment
- `domains/` — business configuration, customer, pet, booking, pricing, payments, and operations
- `ux/` — information architecture, journeys, screen inventory, and design system
- `quality/` — test strategy, acceptance criteria, accessibility, and release quality
- `operations/` — support, monitoring, incident response, backup, and recovery

## Documentation rule

Avoid creating hundreds of speculative documents before they are needed. A document should support a current decision, design, implementation, or test. Cross-link related material and update existing documents instead of duplicating requirements.
