# Migrations

Supabase CLI migrations are the authoritative database history. Generate migrations with the CLI, review the SQL and tenant-isolation impact, test from an empty local database, and commit them with the feature that needs them.

The E02 migrations introduce identity profiles, businesses, locations, memberships, predefined roles and permissions, location scope, audit history, staff invitations, and their row-level-security policies. Future tenant tables must follow the same immutable ownership and composite relationship pattern.

Staff invitations store only token digests, use bounded expiry, bind acceptance to the authenticated email, require MFA for privileged roles, and become unusable after acceptance, revocation, expiry, or supersession.

Invitation preview is a narrow token-bound RPC. It returns only the intended business, email, role, location labels, and expiry for a valid pending token; invalid and terminal tokens return no row.

Privileged MFA enforcement is part of the database authorization helpers. Memberships holding any role marked `requires_mfa` receive no permission or location grant until the current JWT has AAL2 assurance.

The E03 onboarding foundation adds business/location contact and address data, validated weekly location hours, configuration audit triggers, and a tenant-safe foundation readiness function.

Customer arrival and pickup windows are stored separately from operating hours. The initial slice configures weekday windows, closes weekends, validates every window against location operating hours, and preserves tenant-scoped audit history.

Dated closures block location availability for a complete local calendar date. Authorized location managers may add, revise, or remove current and future closures with separate internal reasons and optional customer-facing messages.

The first E04 migration introduces business-scoped customers, households, household membership, and pets. An authorized staff workflow creates the first customer, administrator relationship, household, and dog atomically while enforcing normalized tenant-unique email addresses.

The next E04 slice adds a permission-aware function for adding another dog to an existing active customer household. It derives the household from the tenant-scoped customer relationship rather than trusting a client-supplied household identifier.

Vaccination evidence uses structured pet vaccination records and a private `pet-vaccine-evidence` bucket. PDFs and JPG/PNG images are limited to 10 MB, stored under tenant and pet path prefixes, and begin in pending scan and review states. Authorized staff may accept or reject pending evidence; rejected evidence requires a reason.

Structured pet allergy records capture category, severity, reaction, care instructions, and information source. Records are resolved rather than deleted so safety history and the resolution reason remain available for audit and future visit review.

Pet medication plans capture name, explicit dose, administration route, schedule, instructions, optional effective dates, as-needed indication, and information source. Plans are discontinued through an audited function with a required reason rather than overwritten or deleted.

Pet feeding plans capture food source and product, explicit meal amount and count, schedule, preparation, supplements, information source, and separate-feeding safety. Only one plan may be active per pet; replacement plans require history-preserving discontinuation of the prior plan.

Pet behavior records capture structured risk type and severity, incident or observation context, triggers, preferred and prohibited handling, calming strategies, group-play guidance, observation date, and source. Records are resolved with required context rather than deleted.

Pet health conditions capture structured category, severity, diagnosis date, care impact, emergency instructions, and information source. Severe and critical conditions require emergency instructions, remain visually prominent, and are resolved with preserved history and a required reason rather than deleted.

Pet identifiers capture microchips, licenses, registrations, and other durable identity values with issuer, issue date, and expiration date. Active values are normalized for tenant-scoped duplicate prevention and are retired with a required reason rather than deleted.

Pet profile photos use a private `pet-profile-photos` bucket with 5 MB JPG, PNG, and WebP limits. Object paths are tenant and pet scoped, access follows pet permissions, replacement updates authoritative metadata atomically, and the superseded object is returned for storage cleanup.

Pet service evaluations implement the daycare/group-play lifecycle from pending through approved, conditional, suspended, failed, or expired. Conditional decisions require explicit participation conditions, transitions follow a controlled state machine, duplicate pending requests are blocked, and immutable transition history supports later eligibility decisions.
