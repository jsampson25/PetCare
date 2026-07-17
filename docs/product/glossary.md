# Product Glossary

Status: Authoritative cross-domain vocabulary
Audience: Product, design, engineering, data, quality, support, sales, and implementation partners

## Purpose

This glossary defines the canonical language for PetCare. Domain specifications may add detail, but they must not redefine these terms incompatibly. UI copy may use simpler audience-appropriate wording while preserving the same meaning.

## Naming rules

- Use **booking**, not `reservation`, for the commercial commitment between a customer and a business.
- Use **booking item** for one pet/service/date component inside a booking.
- Use **stay** for boarding-specific time in care; use **operational visit** as the cross-service execution record.
- Use **customer**, not `client` or `pet owner`, as the general business relationship.
- Use **household administrator** when referring to customer portal authority; do not assume every customer legally owns every pet.
- Use **business owner** or the `Owner` tenant role for a business user; use **platform operator** for PetCare personnel.
- Use **business** in customer-facing language and **tenant** when discussing the security or SaaS boundary.
- Use **capacity hold**, not `reservation`, for temporary availability protection during checkout or staff decision.
- Use **resource** as the broad scheduling constraint and **housing unit** for kennels, suites, crates, or rooms used to house a pet.
- Use **payment** for money movement and **invoice** for the amount owed. A payment is not an invoice.
- Use **customer account credit** for value owed to a customer inside one business; do not call it a refund unless money returns through a payment rail.
- Use stable domain and event names even when UI labels are simplified.

## Organization and tenancy

| Term | Canonical definition |
|---|---|
| Platform | The PetCare SaaS product and shared infrastructure serving multiple businesses. |
| Business | A subscribing pet-care organization and the primary tenant boundary. |
| Tenant | The security, data-isolation, configuration, and subscription boundary represented by one business. |
| Location | A physical facility operated within one business. A location is a scope inside a tenant, not a separate tenant. |
| Area | An operational subdivision of a location, such as a boarding wing, play yard, grooming room, or lobby. |
| Business owner | A person holding the tenant `Owner` role. This role does not by itself prove legal ownership. |
| Platform operator | An authorized PetCare employee or contractor operating the SaaS platform. |
| Platform administrator | Avoid as a general person label. Use **platform operator** and name the specific platform role or capability. |
| Subscription | The business’s commercial agreement to use the PetCare platform. Separate from customer memberships. |
| Plan | A versioned SaaS product offering with entitlements, limits, and platform pricing. |
| Entitlement | A platform capability or limit made available to a business by plan, override, or approved program. |
| Feature flag | A platform-controlled release mechanism that changes availability or behavior independently of tenant permission. |
| Tenant configuration | Business-owned settings that control services, policies, operations, branding, and supported workflows. |
| Platform configuration | PetCare-owned settings that apply to infrastructure, plans, global policy, or release behavior. |

## People, accounts, and relationships

| Term | Canonical definition |
|---|---|
| Identity | The stable platform record representing one authenticated person. |
| User | A general interface actor. Prefer the more specific customer, staff member, business owner, or platform operator when known. |
| Customer | A person with a relationship to a pet-care business, whether or not they currently have sign-in access. |
| Customer account | The authenticated portal access associated with an identity and business-scoped customer relationship. |
| Client | Avoid for a customer because it is confused with browser/API clients. Use **customer**. |
| Pet owner | Use only when legal or recorded ownership is specifically established. Otherwise use **customer** or **household member**. |
| Household | A business-scoped grouping of customers who may share pets, bookings, billing relationships, and portal access. |
| Household member | A customer related to a household with an explicit access level. |
| Household administrator | A household member allowed to manage defined household relationships and portal access. |
| Primary contact | The preferred household/customer contact for a defined purpose. It does not imply sole authority. |
| Emergency contact | A person to contact in an emergency. This status does not grant portal or pickup access. |
| Authorized pickup | A business-scoped authorization permitting a person to pick up specified pets under defined conditions. |
| Veterinarian | A veterinary professional or clinic recorded as a pet-care contact; not a PetCare staff role in MVP. |
| Staff member | A person with an active business membership and one or more tenant roles. |
| Business membership | The relationship granting an identity potential staff access to one business. |
| Role | A named template of job-related permissions within a business or the platform. |
| Permission | A stable capability to request a defined action; domain rules and scope still apply. |
| Location scope | The set of locations where a business membership’s permissions may apply. |
| Assignment | Domain-owned responsibility for specific work, pets, services, or records within already authorized scope. |
| Invitation | A single-use, expiring offer to establish a membership or household access relationship. |
| Session | A bounded authenticated interaction with recorded assurance and revocation state. |
| Step-up authentication | Re-verification that temporarily raises assurance for a sensitive action. |
| Support session | A time-limited, purpose-bound, audited platform-operator access context for one tenant. |

## Pets, care, and eligibility

| Term | Canonical definition |
|---|---|
| Pet | The animal receiving or proposed to receive services. MVP workflows primarily target dogs. |
| Pet profile | The business-scoped master record of identity, relationships, care information, documents, and history for a pet. |
| Pet identity | The approved combination of name and additional attributes used to distinguish the correct pet. A photo alone is insufficient. |
| Species | The animal classification, such as dog or cat. |
| Breed | A reference or business-entered breed description. Breed must not be treated as a deterministic behavior rule. |
| Vaccination requirement | A business/service rule stating which vaccine or evidence is required and when it must be valid. |
| Vaccination record | A pet-specific record of vaccine type, dates, evidence, verification, and status. |
| Vaccine evidence | A submitted document or source used to support vaccination verification. |
| Eligibility | Whether a specific pet/customer combination meets requirements for a service and date range. |
| Eligibility decision | A recorded allowed, blocked, conditional, or review-required result with reason codes. |
| Eligibility override | An authorized, reasoned exception to a requirement; not a deletion of the underlying fact or rule. |
| Care plan | The authoritative instructions for feeding, medications, handling, activities, wellness, and other care. |
| Care-plan snapshot | The immutable or revisioned operational copy of relevant care instructions used for one visit. |
| Alert | Prominent information requiring awareness or action. Alerts have scope, severity, lifecycle, and visibility policy. |
| Allergy | A recorded adverse sensitivity relevant to care, food, medication, or products. |
| Medication plan | Instructions describing a medication, dose, route, schedule, conditions, and supporting requirements. |
| Medication task | A scheduled operational instruction to administer or record one medication occurrence. |
| Feeding plan | Instructions describing food, quantity, schedule, preparation, supplements, and restrictions. |
| Meal task | A scheduled operational instruction to prepare, offer, and record one meal. |
| Behavior note | A dated observation or instruction about behavior and handling. It must distinguish observation from diagnosis. |
| Handling instruction | A current safety or care direction for interacting with a pet. |
| Wellness observation | A structured or narrative observation of a pet’s current condition during care. |
| Incident | An event involving injury, illness, safety, escape, conflict, medication, property, or other defined exception requiring formal handling. |
| Report card | A reviewed customer-facing summary of approved care and service information from a visit. |

## Services and catalog

| Term | Canonical definition |
|---|---|
| Service | A configurable offering such as overnight boarding, full-day daycare, grooming, training, or assessment. |
| Service category | A stable classification such as boarding, daycare, or grooming that drives expected configuration and operations. |
| Service version | An immutable effective version of a service definition. |
| Service variant | A selectable version of a service with a distinct shape, duration, price, or requirements. |
| Add-on | An optional service or product attached to a booking item, such as nail trim or private playtime. |
| Bundle | A commercial grouping of multiple items or benefits sold together. |
| Package | Prepaid units or uses that may be redeemed under defined rules. |
| Customer membership | A recurring customer product that provides benefits or included usage. Separate from staff business membership. |
| Assessment | A service or workflow used to determine suitability, behavior, coat condition, or other eligibility before another service. |
| Intake question | A configurable question whose answer is collected for booking or service preparation. |
| Task template | A reusable service/configuration definition used to generate operational tasks. |
| Publication | The act of making a configured service or content version available to its intended audience. |
| Retirement | Preventing a service/version from new selection while preserving historical interpretation. |

## Booking and scheduling

| Term | Canonical definition |
|---|---|
| Booking | The commercial record grouping customer, pets, services, dates/times, prices, policies, agreements, and payment expectations. |
| Reservation | Avoid as the canonical object name. Use **booking**. It may appear only in external/provider language or explanatory prose that cannot be confused with the domain object. |
| Booking item | One pet’s service, schedule, quantity, add-ons, and price contribution within a booking. |
| Appointment | A time-bounded scheduled service, commonly grooming or assessment. It is represented by a booking item, not a separate commercial object. |
| Stay dates | The arrival and departure dates/times for a boarding booking item. |
| Service window | The allowed or scheduled start/end interval for a service. |
| Arrival window | The configured interval in which check-in may occur. |
| Pickup window | The configured interval in which checkout/pickup may occur. |
| Booking status | The commercial lifecycle state of a booking. |
| Draft booking | An incomplete booking not yet submitted or confirmed. |
| Booking request | A submitted request that may still require approval, eligibility, capacity, payment, or documentation. |
| Confirmed booking | A booking whose confirmation requirements are satisfied or whose controlled exception policy allows confirmation. |
| Modification | A controlled change to an existing booking that produces recalculation, revalidation, history, and communications as required. |
| Cancellation | Ending some or all future booking commitments under a recorded policy outcome. |
| No-show | A booking expected to arrive whose customer/pet did not arrive by the defined cutoff and was formally marked accordingly. |
| Waitlist entry | A customer’s request to be considered if eligible capacity becomes available for specified demand. |
| Capacity hold | A temporary, expiring protection of requested capacity while a user completes a decision or checkout step. |
| Quote | A time-bounded calculation of expected charges and terms before final booking snapshot. |
| Booking snapshot | Immutable booking-time facts required to interpret the confirmed commitment later. |

## Resources, capacity, and availability

| Term | Canonical definition |
|---|---|
| Resource | A schedulable or assignable asset whose availability may constrain a service, such as a housing unit, groomer, table, yard, or vehicle. |
| Resource type | A category defining shared resource characteristics and scheduling behavior. |
| Housing unit | A kennel, suite, crate, room, run, or other unit that houses a pet. |
| Kennel | One kind of housing unit. Do not use it as the generic term for all facility resources. |
| Suite | A tenant-facing label for a housing-unit type; it has no universal capacity meaning. |
| Capacity | The quantity of demand a service, pool, resource, staff plan, or interval can safely accept. |
| Capacity pool | A count-based shared capacity definition not tied to one individually assigned resource. |
| Availability | The calculated ability to accept specified demand after rules, closures, holds, commitments, compatibility, and scope are evaluated. |
| Demand | The capacity/resource requirement created by a proposed or committed booking item. |
| Commitment | Demand that consumes or protects capacity under defined booking state rules. |
| Allocation | The recorded assignment of demand to a capacity pool or resource requirement. |
| Resource assignment | The operational assignment of a specific resource, such as Housing Unit 12, to a pet/visit. |
| Closure | A configured interval in which a location, service, resource, or capacity is unavailable. |
| Blackout | Avoid when **closure** or **not bookable** is clearer; use only for a specific defined policy concept. |
| Out of service | A resource state preventing new assignment because of maintenance, cleaning, safety, or other operational reason. |
| Turnover | The transition work required to make a resource ready after use, including cleaning and inspection. |

## Pricing, policies, and agreements

| Term | Canonical definition |
|---|---|
| Price book | A versioned set of rates, adjustments, and commercial rules for a business/location/audience scope. |
| Rate | A monetary amount associated with a charge unit and conditions. |
| Charge unit | The billable basis, such as per night, per day, per appointment, per pet, or per quantity. |
| Price adjustment | A rule that changes a base amount, including seasonal, holiday, demand, multi-pet, or duration logic. |
| Discount | A reduction applied under explicit eligibility and calculation-order rules. |
| Coupon | A customer-presented code or instrument that may activate a discount. |
| Promotion | A configured commercial campaign that may apply automatically or through a coupon. |
| Fee | A separately identified charge triggered by a defined condition. |
| Tax | A jurisdictionally determined amount calculated from approved taxable bases and provider/configuration data. |
| Tip | A voluntary customer-directed amount kept separate from service price and required fees. |
| Deposit | Money required before or as part of booking confirmation, governed by snapshotted policy. |
| Policy | A business rule governing booking, service, payment, cancellation, operations, or customer obligations. |
| Policy version | An effective version of policy content and machine-readable rules. |
| Policy snapshot | The immutable policy facts applied to a booking or action. |
| Agreement | Content that a person is required to acknowledge, accept, or sign. |
| Agreement version | An immutable effective version of agreement content. |
| Acceptance | Evidence that an identified actor agreed to a specific agreement version for a defined scope and purpose. |
| Waiver | A specific type of agreement; do not use as a synonym for every policy or consent. |
| Consent | A recorded permission for a defined purpose, channel, data use, or action, with withdrawal rules where applicable. |

## Invoices, payments, and accounting projections

| Term | Canonical definition |
|---|---|
| Invoice | The business record stating charges, credits, taxes, payments applied, and balance owed. |
| Invoice line | One traceable charge, discount, fee, tax, credit, or adjustment on an invoice. |
| Balance | The net amount currently owed or credited on an invoice/account under defined rules. |
| Payment | A recorded attempt or completed movement of money through an approved payment method. |
| Payment intent | The provider/application record coordinating an intended collection, not proof of settled payment. |
| Authorization | Provider approval to reserve funds; not the same as capture or final settlement. |
| Capture | The action requesting transfer of previously authorized funds. |
| Settlement | Provider processing that moves captured funds according to the payment network. |
| Payment method | A tokenized or provider-managed method used to make a payment. PetCare does not store raw card data. |
| Refund | Money returned through a payment rail against a prior payment. |
| Customer account credit | Business-specific non-cash value available for approved future use. |
| Credit note | A financial document reducing an invoice or recorded amount owed. |
| Void | Cancellation of a financial record or authorization before the relevant completion point, preserving history. |
| Chargeback/dispute | A payer or network challenge to a payment managed through provider and business workflows. |
| Reconciliation | Comparing PetCare records with provider/ledger evidence and resolving differences. |
| Revenue | Earned business income under an approved accounting definition; it is not synonymous with bookings, invoices, or cash collected. |
| Gross booked value | Demand value represented by qualifying booking price snapshots under the Reporting definition. |
| Net collected cash | Completed collections less qualifying refunds under the Reporting definition. |

## Operations and service execution

| Term | Canonical definition |
|---|---|
| Operational visit | The cross-service execution record covering a pet’s contiguous period in the business’s care. |
| Visit | Acceptable short form for **operational visit** in staff contexts after the meaning is established. |
| Stay | A boarding-specific operational visit or boarding portion of one; do not use for grooming-only appointments. |
| Service execution | The operational performance of one booked service within an operational visit. |
| Check-in | The controlled transfer into care and activation of the operational visit. |
| Checkout | The controlled completion of custody, belongings, care, authorization, and financial handoff. Use one word in product UI and domain naming. |
| Pickup | The physical handoff of a pet to an authorized person; it is one part of checkout. |
| Custody | The recorded period in which the business is responsible for the pet. |
| Intake | Collection and verification of current pet, care, belongings, service, and authorization information near check-in. |
| Task | A unit of operational work with owner/assignee, timing, status, result, and audit context. |
| Care task | A task directly related to pet care, such as feeding, medication, potty, activity, or wellness. |
| Service task | A task required to execute a booked service. |
| Checklist | An ordered or grouped set of verifications; completion does not replace domain evidence where separate records are required. |
| Timeline event | An append-only or revision-aware record of meaningful activity on a customer, pet, booking, visit, invoice, or other object. |
| Actual time | When an event occurred in the real world. |
| Recorded time | When PetCare stored the event. |
| Correction | An auditable change that preserves prior value and explains why the record was corrected. |
| Exception | A deviation requiring additional handling, reason, escalation, or approval. |
| Escalation | Routing an unresolved, overdue, risky, or high-severity condition to a responsible role. |
| Work queue | A prioritized collection of actionable operational items. |
| Boarding board | A role/location-aware view of pets, housing, care, status, and exceptions for boarding operations. |
| Daycare board | A role/location-aware view of attendance, playgroups, rotations, and daycare exceptions. |
| Grooming board | A production view of appointments/service executions by grooming stage and assignment. |
| Playgroup | A controlled group activity session or grouping governed by compatibility, supervision, and capacity rules. |
| Enrichment | A planned physical, cognitive, sensory, or social activity intended to support wellbeing. |

## Communications and content

| Term | Canonical definition |
|---|---|
| Communication intent | A domain request to communicate a defined purpose to an audience. |
| Message | The rendered communication content for one channel/recipient attempt. |
| Conversation | A related two-way communication thread linked to authorized business objects. |
| Channel | A delivery method such as email, SMS, push, in-app, or web inbox. |
| Transactional communication | A message necessary for an existing account, booking, payment, care, security, or service relationship. |
| Marketing communication | A promotional message governed by marketing consent and suppression rules. |
| Template | Versioned reusable communication or document content with approved variables. |
| Delivery event | Provider or platform evidence that a message was accepted, delivered, failed, bounced, or otherwise changed state. |
| Suppression | A rule preventing delivery to a recipient/channel for consent, failure, abuse, or policy reasons. |
| Public website | The tenant-branded public content and booking entry surface. |
| Page | A publishable website content unit with route, sections, SEO metadata, and version. |
| Theme | The validated tenant-controlled visual configuration applied within platform design boundaries. |
| Preview | A non-public rendering of draft content or configuration for review. |
| Publish | Make an approved version live for its intended audience. |
| Custom domain | A verified tenant-owned hostname mapped to one business’s public website. |

## Reporting and measurement

| Term | Canonical definition |
|---|---|
| Metric | A versioned calculation with owner, grain, filters, exclusions, time basis, and source lineage. |
| KPI | A metric selected to assess progress toward a business objective. Not every metric is a KPI. |
| Dimension | An attribute used to group, filter, or compare a metric. |
| Grain | The level represented by one row or observation in a dataset. |
| Measure | A numeric value aggregated under a metric definition. |
| Operational date | A business-defined date used for daily operations, which may differ from UTC date. |
| Freshness | How current a report or projection is relative to its source. |
| Snapshot | A recorded point-in-time representation used for historical interpretation. |
| Projection | Derived read model built from authoritative source records. |
| Report | A defined presentation of metrics, records, filters, and supporting context. |
| Dashboard | A role-oriented collection of current metrics, alerts, and drill-down paths. |
| Export | A generated file containing an authorized, time-bounded view of data. |
| Occupancy | Used capacity divided by defined sellable capacity for an explicit service/resource/time grain. |
| Utilization | Actual or committed use of a resource relative to its defined availability. It is not automatically occupancy. |
| Conversion rate | A numerator divided by an eligible denominator under a named funnel definition. |

## Security, privacy, and reliability

| Term | Canonical definition |
|---|---|
| Authentication | Establishing or verifying control of an identity. |
| Authorization | Deciding whether an actor may perform an action on a resource in the current context. |
| Tenant isolation | Prevention of one tenant reading, changing, inferring, or exhausting another tenant’s data/resources. |
| Row-level security (RLS) | PostgreSQL policy enforcement that restricts rows visible or mutable to a database role/context. |
| Personally identifiable information (PII) | Data that identifies or can reasonably identify a person under applicable policy/law. |
| Sensitive data | Data requiring enhanced controls due to privacy, safety, security, financial, contractual, or legal impact. |
| Audit event | Tamper-resistant evidence of a meaningful action, actor, target, time, context, and outcome. |
| Domain event | A fact emitted after a meaningful domain state change. |
| Correlation ID | A non-secret identifier connecting related requests, jobs, events, and logs. |
| Idempotency | The property that safe retries do not duplicate the intended business effect. |
| Idempotency key | A purpose-scoped identifier used to recognize retry of the same command. |
| Optimistic concurrency | Detection of conflicting changes using a version or precondition rather than broad locking. |
| Soft deletion | Making a record inactive/unavailable while retaining required history. Prefer **archive** when that is the actual product action. |
| Archive | Remove a record from active use while preserving history and references. |
| Retention | The period and conditions under which data must or may be kept. |
| Legal hold | A restriction preventing deletion due to a legal or compliance obligation. |
| Break-glass access | Exceptional, tightly controlled emergency access with strong justification and review. |
| Feature kill switch | A platform control that quickly disables risky behavior without redefining user permission. |
| Degraded mode | A deliberate reduced-capability operating state that preserves core safe behavior during dependency failure. |

## Product delivery and quality

| Term | Canonical definition |
|---|---|
| Requirement | A uniquely identified, testable statement of needed product behavior or quality. |
| Business rule | A domain-owned constraint or decision rule that must remain true. |
| Acceptance criterion | A specific observable condition proving that a requirement or feature outcome is satisfied. |
| Acceptance test | Executable or manual verification linked to acceptance criteria and requirement evidence. |
| Definition of done | The shared evidence required before work is considered complete. |
| Release gate | A condition that blocks deployment until satisfied or formally resolved. |
| Defect | A divergence between actual behavior and an accepted requirement, standard, or safe expected outcome. |
| Incident (platform) | A production event affecting confidentiality, integrity, availability, or service operation. Use **pet-care incident** when ambiguity exists. |
| MVP | The smallest launch scope that safely delivers the core customer and business value. |
| P0/P1/P2/Future | Product priority levels defined in the Master Requirements Index. |
| Q0/Q1/Q2/Q3 | Test criticality levels defined in the Platform Test Strategy. |
| S0/S1/S2/S3 | Defect severity levels defined in the Platform Test Strategy. |

## Approved abbreviations

Use the full term on first meaningful use in customer-facing or general documentation.

| Abbreviation | Meaning |
|---|---|
| API | Application programming interface |
| CDN | Content delivery network |
| CI | Continuous integration |
| MFA | Multi-factor authentication |
| PII | Personally identifiable information |
| RLS | Row-level security |
| SEO | Search engine optimization |
| SLA | Service-level agreement |
| SMS | Short message service/text message |
| UTC | Coordinated Universal Time |
| WCAG | Web Content Accessibility Guidelines |

## Prohibited ambiguous usage

| Avoid | Use instead |
|---|---|
| Reservation (commercial object) | Booking |
| Reservation item | Booking item |
| Client (person) | Customer |
| Pet owner (unverified general relationship) | Customer or household member |
| Admin | Business owner, manager, access administrator, or platform operator |
| Account | Identity, customer account, business membership, subscription, or financial account—name which one |
| Facility (when location is intended) | Location |
| Kennel (for every housing option) | Housing unit |
| Available (without basis) | State the service/resource/date and rule basis |
| Revenue (for bookings or cash) | Gross booked value, net invoiced amount, collected cash, or recognized revenue |
| Credit | Customer account credit, credit note, or payment-network credit—name which one |
| Delete | Archive, cancel, revoke, void, purge, or delete—name the actual lifecycle action |
| Visit (commercial transaction) | Booking |
| Visit (operational, before meaning established) | Operational visit |
| Owner (without context) | Business owner, household administrator, recorded pet owner, or platform owner |
| Status | Name the object: booking status, payment status, task status, visit status, etc. |

## Governance

- New cross-domain terms must be added here before they become common implementation vocabulary.
- Domain-specific terms may live in domain specifications but must link here when they overlap shared concepts.
- Renaming a persisted entity, API, event, or metric requires impact analysis and, when material, an architecture decision.
- UI synonyms must be recorded when they differ from canonical domain language.
- Requirements, schemas, events, code, analytics, and tests should use the canonical term.
- Historical external payloads may retain provider terminology behind adapters.
- The glossary is reviewed before a foundation document moves from `In progress` to `Accepted`.
