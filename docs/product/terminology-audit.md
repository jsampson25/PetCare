# Terminology Consistency Audit

Status: Initial repository audit complete; follow-up remains continuous  
Scope: Product, architecture, domain, UX, requirements, and quality documentation

## Outcome

The canonical vocabulary is now defined in the [Product Glossary](glossary.md). The audit found that the repository is broadly aligned, with one material drift: `reservation` was used in reporting for the commercial object that other specifications call `booking`.

## Canonical decisions

| Topic | Decision | Rationale |
|---|---|---|
| Booking vs. reservation | `Booking` is canonical | It already owns the domain and lifecycle; two object names would split APIs, metrics, and events |
| Booking vs. operational visit | Booking is commercial; operational visit is execution/custody | A cancelled booking may have no visit; one visit may coordinate several service executions |
| Stay vs. visit | Stay is boarding-specific; operational visit is cross-service | Grooming/daycare do not always represent an overnight stay |
| Customer vs. pet owner | Customer is general; pet owner only when ownership is established | Household access, emergency contact, and pickup authority are separate relationships |
| Business vs. tenant | Business is product language; tenant is the security/SaaS boundary | Keeps customer-facing language natural without weakening architecture meaning |
| Business owner vs. platform operator | These are separate roles | Avoids confusing tenant authority with PetCare authority |
| Resource vs. housing unit | Resource is general; housing unit is the pet-housing subset | Kennels, suites, staff, yards, and tables have different meanings |
| Capacity hold vs. reservation | Capacity hold is temporary demand protection | Avoids collision with booking terminology |
| Invoice vs. payment | Invoice records what is owed; payment records money movement | Required for reconciliation and reporting accuracy |
| Refund vs. credit | Refund returns money; customer account credit stores business-specific value | Different financial and customer consequences |

## Corrections applied in this milestone

- Expanded the glossary from a minimal term list into categorized canonical vocabulary.
- Added explicit approved/avoid terminology rules.
- Standardized Reporting-domain commercial references from `reservation` to `booking`.
- Standardized Reporting event examples from `reservation.*` to `booking.*`.
- Reworded temporary capacity language so a capacity hold is not called a reservation.
- Reworded public-site inquiry confirmation to state that no booking was created.
- Added glossary governance and ambiguity rules.

## Contextually valid words

Some flagged words remain valid:

- `Client` is valid when referring to browser, mobile, or API client software.
- `Owner` is valid when it is the exact tenant role name or a clearly qualified record owner.
- `Appointment` is valid for the scheduled time shape of grooming or assessment, while the commercial entity remains a booking item.
- `Visit` is valid as the established short form for operational visit in staff workflow documentation.
- `Reservation` may appear when quoting discouraged customer copy or an external provider’s fixed terminology.
- `Kennel` and `suite` are valid tenant-facing housing-unit types, but not universal architecture labels.

## Continuous checks

Before accepting a document or implementation:

1. Search new content for prohibited ambiguous usage from the glossary.
2. Confirm entity, API, event, metric, UI, and test names refer to the same concept.
3. Qualify overloaded terms such as owner, account, status, credit, incident, and visit.
4. Record deliberate user-facing synonyms.
5. Update the glossary when a new cross-domain concept is approved.
6. Treat a terminology change affecting persisted contracts as a migration and compatibility concern.

## Known follow-up areas

- Decide whether the internal entity will be named `OperationalVisit`, `CareVisit`, or another implementation name before schema work.
- Decide whether UI uses `checkout` or `check-out`; current domain naming uses `Checkout` and prose should prefer `checkout` as a noun/action label.
- Define supported customer-facing labels for tenant-configurable housing types.
- Review metric display names during reporting implementation so financial terms cannot imply accounting recognition.
- Add automated terminology linting only after its exception model can avoid noisy false positives.

## Related specifications

- [Product Glossary](glossary.md)
- [Master Requirements Index](../requirements/README.md)
- [Information architecture and navigation](../ux/information-architecture.md)
- [Booking and Waitlist domain](../domains/booking-waitlist/README.md)
- [Operations domain](../domains/operations/README.md)
- [Reporting domain](../domains/reporting/README.md)
- [Platform test strategy](../quality/test-strategy.md)

