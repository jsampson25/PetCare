# Role and Permission Presentation Model

Status: Authoritative UX foundation specification  
Audience: Product, design, engineering, QA, security, support, and tenant onboarding  
Applies to: Customer Portal, Business Portal, Staff Operations, Platform Console, and public-to-authenticated transitions

## 1. Purpose

This document defines how PetCare presents identity, roles, scopes, permissions, restrictions, and access changes to users. It translates the authorization model into predictable interface behavior without duplicating or weakening server-side policy.

The Identity and Access Management domain remains authoritative for authorization. This document governs presentation: what appears in navigation, which controls are shown, how limited access is explained, how administrators assign access, and what users experience when their access changes.

## 2. Core rule

```text
Interface visibility is not authorization.
```

Every protected route, query, mutation, download, background task, and real-time subscription must be authorized by trusted server-side policy. Hiding a link or disabling a button is never sufficient protection.

The interface should reduce confusion and prevent futile actions, but it must assume that URLs, requests, cached pages, and client state can be manipulated.

## 3. Goals

- Show each user the smallest coherent product appropriate to their work.
- Make active business, location, role, and delegated context clear.
- Prevent unauthorized data from being revealed through navigation, search, counts, errors, previews, or cached state.
- Explain correctable restrictions without disclosing sensitive policy or record existence.
- Make role assignment understandable to nontechnical business owners.
- Preserve safe workflows when permissions change during a session.
- Separate role permission from domain state, approval, ownership, and policy eligibility.
- Make access changes reviewable and auditable.

## 4. Non-goals

This document does not:

- Define authentication protocols or token storage.
- Replace the IAM permission catalog or policy engine.
- Define every domain business rule.
- Permit client-side authorization decisions.
- Introduce arbitrary tenant-defined permissions for MVP.
- Treat pickup authorization, household membership, pet ownership, or task assignment as staff roles.

## 5. Access concepts users must understand

| Concept | User-facing meaning | System meaning |
|---|---|---|
| Identity | The signed-in person | Stable authenticated identity |
| Account type | Customer, business user, or platform operator experience | Classification and allowed portal context |
| Business membership | Access to work for one business | Identity-to-tenant relationship |
| Role | A named set of job-related capabilities | Platform-defined permission template |
| Location access | Places where the role applies | Dynamic all-location or explicit location scope |
| Assignment | Work or records currently assigned to the user | Domain restriction inside granted scope |
| Permission | An allowed action category | Stable action-oriented permission key |
| Approval | A required second decision | Domain workflow, not a general permission |
| Step-up verification | Reconfirm identity for a sensitive action | Temporary higher session assurance |
| Support access | Time-limited platform assistance | Audited platform support session |

The UI should use plain language such as `Can issue refunds` or `Access to Downtown and Airport locations`. Internal permission keys may appear only in advanced diagnostic or platform-administration views.

## 6. Authorization layers

An action may appear available only after all relevant layers are satisfied:

```text
Signed-in identity
  + active account and tenant
  + correct product surface
  + active membership or customer relationship
  + role permission
  + business and location scope
  + record relationship or assignment
  + domain state and policy
  + required approval or step-up
  = action may proceed
```

The interface must not describe every failed layer as `You do not have permission`. For example:

- `This booking is already checked in` is a state restriction.
- `Manager approval is required` is an approval requirement.
- `Choose a location to continue` is missing context.
- `Verify your identity to issue this refund` is step-up authentication.
- `You do not have access to refunds` is a permission restriction.

## 7. Product contexts

### 7.1 Customer context

Customer access comes from business-scoped household and pet relationships. Customer users must not see staff roles or internal permission language.

Customer-facing descriptions include:

- `You can manage Bella's profile and bookings.`
- `Only a household administrator can invite another person.`
- `Contact the business to change pickup authorization.`

### 7.2 Business context

Business users operate under one active tenant, one location context, and their effective roles. The application shell displays the business identity and, when relevant, location scope.

### 7.3 Platform context

Platform operators use a separate console and platform roles. Tenant permissions do not grant platform access. Platform support access into a tenant must be visibly distinct, time-limited, purpose-bound, and audited.

### 7.4 Multiple contexts

One identity may be a customer of one business, staff at another, and owner of a third. The context switcher must:

- Group experiences clearly by business and relationship.
- Never blend navigation or data across contexts.
- Require explicit selection before privileged work.
- Clear tenant-specific caches, searches, filters, and real-time subscriptions on switch.
- Return only to an authorized route in the new context.

## 8. Role presentation

### 8.1 MVP predefined roles

| Role | Plain-language summary |
|---|---|
| Owner | Full business administration, security, billing, and authorized business operations |
| Manager | Broad operational oversight for assigned locations, with selected administrative rights |
| Front desk | Customers, pets, bookings, arrivals, departures, routine payments, and communications |
| Care staff | Daily pet care, assigned operational tasks, observations, and permitted incidents |
| Groomer | Grooming schedule, assigned pets, service work, notes, and approved media |
| Accountant | Invoices, payments, reconciliation, and authorized financial reporting |
| Marketing editor | Website content and approved customer communications |
| Read-only auditor | Selected records and reports without modification |

Role summaries must state what the role is intended for, not promise access to every record. Location, assignment, tenant configuration, and domain rules still apply.

### 8.2 Role badges

Role badges are appropriate in:

- Staff directory rows and profiles.
- Invitation and role-change review screens.
- Access review reports.
- The signed-in user’s account/access page.

Role badges should not appear on every operational record. Access is not a social rank, and excessive badges create noise.

### 8.3 Multiple roles

When a membership has more than one role:

- Display all assigned roles in access administration.
- Summarize effective capabilities by category.
- Do not ask users to toggle roles to gain permissions within the same membership.
- Make location scope visible for each assignment when scopes differ.
- Explain that combined roles may broaden access within the same tenant and permitted scope.

### 8.4 Owner distinction

`Owner` is a privileged access role, not proof of legal ownership of the business. UI copy must avoid legal claims unless supported by separately verified business records.

The last active owner receives explicit protection messaging and cannot remove or demote themselves until another eligible owner is active.

## 9. Navigation behavior

### 9.1 Primary navigation

- Show destinations the user can meaningfully access.
- Do not show empty product sections solely because one low-level permission exists.
- Keep terminology and ordering stable across users even when destinations are omitted.
- Do not expose unauthorized record counts, alert badges, or recent-item names.
- A location-scoped user sees only navigation data from authorized locations.
- New permissions appear after effective authorization refresh, not only after a full browser restart.

### 9.2 Partial destination access

If a user can access only part of a destination:

- Open the permitted subsection directly when that produces a coherent experience.
- Hide unauthorized tabs and actions.
- Preserve stable URLs for permitted content.
- Do not show a mostly empty page filled with lock icons.

Example: a marketing editor may open `Website` directly to pages and media without seeing domain, billing, or technical settings.

### 9.3 Navigation personalization

User pinning or reordering may affect visible authorized destinations only. Personalization cannot reveal hidden destinations, override role policy, or create a misleading shared support layout.

## 10. Control visibility rules

Use the following decision order:

| Condition | Presentation |
|---|---|
| User can act now | Show enabled control |
| User is authorized but a correctable prerequisite is missing | Show disabled control with reason or show enabled control leading to prerequisite resolution |
| User is authorized but approval/step-up is required | Show enabled control and begin the required verification or approval flow |
| User lacks the permission and cannot request it in context | Hide the control |
| User lacks permission but access request is an intentional workflow | Show a clear `Request access` or contact-owner path |
| Action is impossible due to final domain state | Hide it or show final state, depending on whether explanation is useful |
| Destructive action is policy-blocked | Show blocked state and safe explanation to authorized administrators |

### 10.1 When to hide

Hide an action when:

- Its presence would disclose a sensitive capability or object.
- The user has no realistic path to use it.
- It would create clutter in a task-focused surface.
- The same explanation is available in access administration.

### 10.2 When to disable

Disable an action only when the reason helps the user proceed. A disabled control must be perceivable and its reason available without hover alone.

Good examples:

- `Select one location to create a booking.`
- `Upload the required vaccination record before confirming.`
- `Manager approval is required for refunds over $250.`

Poor example:

- `Unavailable.`

### 10.3 Read-only presentation

Read-only users receive:

- Values styled as content, not a forest of disabled form inputs.
- No drag handles, edit affordances, selection checkboxes, or save buttons.
- A visible `Read-only access` explanation where ambiguity could arise.
- Export and sensitive-field access only when separately granted.

## 11. Field and section security

Permissions may apply below the page level. Presentation rules include:

- Remove unauthorized fields from rendering and response payloads.
- Do not replace sensitive values with revealing masks such as `•••• 4821` unless viewing the suffix is authorized.
- Show a neutral omitted section rather than field-by-field locks when the entire category is restricted.
- Separate operational blockers from financial details: staff may see `Payment required before checkout` without invoice or processor data.
- Internal notes, medical observations, incident evidence, employee details, and financial data require explicit category policy.
- Print, export, copy, notification, and search behavior must use the same field policy as the primary screen.

## 12. Record existence and denial responses

Protected objects must not be enumerable.

### 12.1 Direct links

When a user opens an unauthorized or nonexistent protected record:

- Use a neutral response where distinguishing the conditions would disclose existence.
- Do not include the record’s name, customer, pet, location, or status.
- Offer safe navigation back to an authorized home or list.
- Do not render cached details before the denial completes.

Recommended message:

> This record is unavailable. It may have been removed, or you may not have access in the current business or location.

### 12.2 Known administrative records

An authorized access administrator may receive a more specific explanation for a staff membership they are permitted to manage, such as `Suspended by Morgan Lee on July 16`. This specificity must not carry into general operational surfaces.

## 13. Search, counts, and suggestions

- Search authorization happens before result counts, snippets, facets, and suggestions are produced.
- `0 results` must not imply whether unauthorized results exist.
- Recent items, command palettes, browser suggestions, and notification previews are scope-filtered.
- Typeahead does not reveal customer names, pet names, addresses, balances, or staff outside effective access.
- Aggregate dashboards enforce minimum visibility and field policy before displaying metrics.
- Saved searches re-evaluate authorization every time they run.

## 14. Location scope presentation

### 14.1 Context indicator

The business shell shows one of:

- A named location.
- `All authorized locations`.
- A concise multi-location selection.

Avoid simply saying `All locations` when the user has access to only some locations.

### 14.2 Starting actions

- Location-specific creation requires one valid location.
- All-location reporting may remain aggregated when permitted.
- Switching location refreshes lists, counts, notifications, commands, and real-time data.
- If a record belongs to another authorized location, its header states that location rather than silently switching context.
- If the location is unauthorized, use the protected-record denial behavior.

### 14.3 Scope administration

Access administration distinguishes:

- `All current and future locations` as a dynamic privileged scope.
- `Selected locations` as explicit assignments.
- `Assigned work only` as a domain restriction, not a location role.

The review step must make the future-location consequence of dynamic scope explicit.

## 15. Staff invitation and access assignment UX

### 15.1 Invitation form

The form collects:

- Invitee email.
- Intended role or roles.
- Location scope.
- Optional start/end timing if supported.
- A reviewable summary of high-risk capabilities.

Do not present hundreds of raw permission checkboxes in MVP.

### 15.2 Review before send

The review screen states:

- Business name.
- Invitee.
- Roles.
- Locations.
- High-risk capabilities.
- MFA requirement.
- Invitation expiration.

Owner or elevated-role invitations require stronger warning, step-up authentication, and explicit confirmation.

### 15.3 Invitation state

Staff lists distinguish:

- Invitation pending.
- Active access.
- Invitation expired.
- Suspended.
- Access revoked or ended.

Pending invitations are not represented as active staff access.

### 15.4 Existing identity

The inviter must not learn whether the email already has unrelated PetCare accounts or memberships. The invitee authenticates before linking access.

## 16. Role-change UX

### 16.1 Change review

Before applying a role or scope change, show:

- Current access.
- Proposed access.
- Capabilities gained and lost by category.
- Locations gained and lost.
- Active work that may be affected.
- MFA or step-up consequences.
- Session refresh or sign-out behavior.

### 16.2 Immediate effect

After a successful change:

- Server authorization uses the new state immediately for subsequent decisions.
- Relevant sessions, caches, downloads, and subscriptions refresh or revoke.
- The administrator receives a confirmation and audit reference.
- The affected user receives an appropriate notification for meaningful changes.
- In-progress work is handled safely; it is never silently submitted under stale access.

### 16.3 Self-change protection

- Users cannot grant themselves permissions they do not already have authority to assign.
- Owners cannot bypass last-owner protection.
- Managers cannot assign a role or location outside their own delegation authority.
- The UI does not offer these changes, and the server rejects attempted requests.

## 17. Access removal and suspension

| Action | Intended use | User experience |
|---|---|---|
| Suspend | Temporarily block work access | Sessions revoked; membership retained; reactivation available |
| End access | Relationship ended normally | Access removed; historical authorship retained |
| Revoke | Immediate explicit removal | Sessions revoked; audit reason required |
| Disable identity | Platform/account security action | All memberships become ineffective |

Before removal, administrators see impacts such as assigned future shifts, grooming appointments, open approvals, scheduled reports, or owned drafts. Domains define reassignment requirements.

Historical records continue to display an appropriate actor name or retained audit identifier according to privacy policy; they are never rewritten as if another user performed the action.

## 18. Access-request experience

Access requests are supported only where the organization intentionally enables them.

A request includes:

- Requested capability or task.
- Business and location.
- Optional business reason.
- Appropriate approver.
- Expiration when temporary access is requested.

The requester must not choose arbitrary permission keys or infer restricted records. Approval cannot grant more than the approver is allowed to delegate.

When no request workflow exists, say who can help in business language, such as `Ask a business owner or manager with staff-access permission.`

## 19. Step-up authentication and approval presentation

Step-up verification and business approval are different:

- **Step-up** reconfirms the current person’s identity.
- **Approval** records another authorized decision or fulfills a business threshold.

The UI must identify which is required, why, how long the result applies, and whether the original action will resume afterward.

Do not use generic `Permission required` messaging for either case.

## 20. Delegated administration

An administrator’s assignment authority is bounded by:

- Their active tenant membership.
- A dedicated staff-administration permission.
- Roles they are allowed to grant.
- Locations they are allowed to administer.
- Prohibition on granting privileges above their delegation ceiling.
- Step-up requirements for high-risk changes.

The role editor shows only roles and locations the administrator may assign. Server validation remains authoritative.

## 21. Support-access presentation

When a platform operator enters a tenant through an approved support session:

- A persistent, high-visibility banner identifies support mode, tenant, purpose, and remaining time.
- The operator’s platform identity remains visible; they do not impersonate a tenant user invisibly.
- Unsupported actions are absent or blocked according to support-session scope.
- Sensitive values may remain masked unless explicitly authorized.
- The session offers a clear exit and ends automatically at expiration.
- Tenant-visible audit history records access according to policy.

Support screenshots, exports, and copied links must not create a path around session scope.

## 22. Shared-device and shift behavior

- Shared staff devices still require individual identities.
- A quick user-switch flow signs out or locks the prior user before the next session begins.
- Do not retain the prior user’s recent records, search terms, notifications, or drafts after switch.
- Kiosk or station mode has an explicit limited role and device policy; it is not a shared owner account.
- Reauthentication after inactivity returns to the same task only if the user remains authorized.
- Shift assignment may prioritize work but does not replace authorization.

## 23. Permission-aware content and help

- Help content adapts to the user’s visible experience without exposing hidden capabilities.
- Empty states do not recommend actions the user cannot perform.
- Onboarding checklists assign steps only to roles that can complete them.
- Emails and notifications link only to routes the recipient is expected to access, while access is still re-evaluated at open time.
- Public documentation may describe product capabilities generally, but in-product help must not imply the current user has them.

## 24. Accessibility requirements

- Role and status are conveyed with text, not color or icon alone.
- Disabled-control explanations work with keyboard, touch, zoom, and screen readers.
- Hidden controls are removed from focus order and the accessibility tree.
- Permission-denied messages receive a logical heading and focus location.
- Access comparison tables have semantic headers and a usable compact alternative.
- Role selection and location selection do not require drag-and-drop.
- Dynamic permission changes announce updated state without flooding live regions.
- High-risk warnings use plain language and do not depend on visual placement.

See [Responsive and accessibility interaction standards](responsive-accessibility-standards.md).

## 25. Responsive behavior

- Compact staff views prioritize current context, current role-relevant task, and primary action.
- Access-administration comparison tables become labeled capability groups, not horizontally clipped grids.
- Role and scope review remains visible before confirmation on small screens.
- Context switchers show full business and location names before selection.
- Permission explanations may use disclosures, but warnings and consequences remain visible.
- Platform support-mode banners cannot collapse into an ambiguous icon.

## 26. Audit presentation

Authorized access administrators can review:

- Invitation created, resent, expired, accepted, or revoked.
- Role assigned or removed.
- Location scope changed.
- Membership suspended, restored, ended, or revoked.
- Owner added, transferred, or removed.
- MFA requirement changed or recovery performed.
- Access request approved, denied, expired, or revoked.
- Support session opened and closed.

Each entry includes actor, action, subject, tenant, relevant scope, timestamp, reason where required, and correlation reference. Audit views themselves are permission- and field-scoped.

## 27. Error and state catalog

| State | Recommended user-facing treatment |
|---|---|
| Not signed in | Sign-in prompt with safe return route |
| Session expired | Reauthenticate; preserve safe unsaved work where possible |
| Wrong tenant context | Offer authorized context switch without revealing protected object details |
| Wrong location context but authorized | Explain location and offer switch |
| Permission missing | Explain limitation or hide action according to this model |
| Domain state blocks action | Explain the state and valid next step |
| Step-up required | Explain verification and resume action afterward |
| Approval required | Identify approval process without exposing unauthorized approver data |
| Membership suspended | State that work access is suspended and provide administrator contact path |
| Tenant suspended | Use tenant lifecycle messaging; do not imply a personal permission problem |
| Access changed mid-task | Stop safely, preserve non-sensitive draft where allowed, and explain change |
| Record unavailable | Neutral non-enumerating response |

## 28. Analytics and telemetry

Permitted telemetry includes:

- Denied action category and policy reason code.
- Surface, tenant, location, and role category using privacy-safe identifiers.
- Access-request completion and decision time.
- Invitation acceptance and expiration rates.
- Frequency of users reaching disabled prerequisites.
- Mid-session revocation and safe recovery outcomes.

Telemetry must not record credentials, tokens, sensitive record contents, full export parameters, or unauthorized object details. Product analytics never receives more data than the user interface was permitted to display.

## 29. Acceptance criteria

### RPM-AC-001: Hidden navigation is not authorization

**Given** a care staff member lacks financial permissions  
**When** they manually open a financial URL  
**Then** the server denies access, no financial data or count is returned, and the response provides a safe route back.

### RPM-AC-002: Correctable prerequisite

**Given** a manager is authorized to create bookings but is viewing all authorized locations  
**When** they invoke `New booking`  
**Then** the interface requires one authorized location and explains why without reporting a permission error.

### RPM-AC-003: Role change takes effect

**Given** a groomer’s location access is removed  
**When** an administrator confirms the change  
**Then** subsequent queries, subscriptions, cached lists, and direct routes stop exposing that location, and in-progress work is handled safely.

### RPM-AC-004: No record enumeration

**Given** a user lacks access to a booking  
**When** they open its copied URL  
**Then** the response does not reveal whether the booking exists or disclose its customer, pet, location, or status.

### RPM-AC-005: Delegation ceiling

**Given** a manager may administer front-desk and care roles only at Downtown  
**When** they edit another staff member  
**Then** higher roles and other locations are not assignable, and a manipulated request is rejected server-side.

### RPM-AC-006: Read-only experience

**Given** an auditor can view selected operational reports  
**When** the report opens  
**Then** content is presented read-only, mutation controls are absent, and export appears only if separately authorized.

### RPM-AC-007: Customer relationship language

**Given** a customer can view a pet but cannot manage household access  
**When** they open account settings  
**Then** the interface explains the household limitation without displaying staff roles or internal permission keys.

### RPM-AC-008: Support mode is explicit

**Given** a platform operator begins an approved tenant support session  
**When** tenant information appears  
**Then** a persistent banner identifies support mode, tenant, purpose, and expiry, and the session cannot silently become ordinary tenant access.

### RPM-AC-009: Accessible denial

**Given** a keyboard and screen-reader user reaches an unavailable route  
**When** the denial page loads  
**Then** focus moves to a meaningful heading, the reason is understandable, and an authorized navigation path is available.

### RPM-AC-010: Last-owner protection

**Given** a tenant has one active owner  
**When** that owner attempts to remove or demote themselves  
**Then** the interface explains the required replacement-owner flow and the server rejects bypass attempts.

## 30. Definition of done

A permission-aware feature is complete only when:

- Required permission and scope are documented.
- Navigation, route, query, action, field, export, notification, and search behavior agree.
- Server-side enforcement and tenant isolation are tested.
- Correctable prerequisites are distinguished from permission denials.
- Direct-link, stale-session, and mid-session change scenarios are tested.
- Compact and accessible presentations are verified.
- Audit events and administrator confirmations are defined.
- No client response contains unauthorized fields or counts.
- Role labels and explanations use approved plain language.

## 31. Open decisions

- Exact MVP manager delegation ceiling.
- Whether temporary staff access expiration is included in MVP.
- Which permissions qualify for an in-product access-request workflow.
- Which role combinations should trigger owner warnings.
- Whether users may customize role-aware navigation in MVP.
- Tenant-visible detail level for platform support sessions.
- Access review cadence and owner reminders.
- Standard policy for preserving or discarding drafts after revocation.

## 32. Related specifications

- [Identity and Access Management domain](../domains/identity-access/README.md)
- [Platform Administration domain](../domains/platform-administration/README.md)
- [Customer and Household domain](../domains/customer-household/README.md)
- [Information architecture and navigation](information-architecture.md)
- [Design system foundation](design-system.md)
- [Responsive and accessibility interaction standards](responsive-accessibility-standards.md)
- [Business onboarding journey](business-onboarding-journey.md)
- [Requirements traceability](../requirements/traceability.md)

