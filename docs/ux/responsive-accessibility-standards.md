# Responsive and Accessibility Interaction Standards

Status: Authoritative foundation specification  
Audience: Product, design, engineering, QA, security, support, and implementation partners  
Applies to: Public websites, customer portal, staff workspace, business console, and platform console

## 1. Purpose

PetCare must remain understandable, operable, and safe across device sizes, input methods, assistive technologies, and working conditions. This document defines the shared responsive and accessibility rules for every product surface.

These standards are requirements, not optional polish. A feature is not complete when it works only with a mouse, only at a desktop width, only with default text size, or only for users who can perceive color, animation, sound, or photographs.

## 2. Conformance baseline

PetCare targets [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) for all web surfaces.

Implementation must also follow these principles:

- Prefer semantic HTML and native browser controls.
- Use ARIA only when native semantics cannot express the required interaction.
- Use the [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) as interaction guidance for complex widgets.
- Treat APG as guidance rather than a normative conformance standard or a complete design system.
- Preserve accessibility through tenant branding, localization, responsive changes, feature flags, and third-party integrations.
- Never rely on automated tooling alone to claim conformance.

Legal and contractual requirements may impose additional obligations. Product and legal owners must record any jurisdiction-specific requirement without weakening this baseline.

## 3. Product accessibility principles

1. **Equivalent outcome:** users must be able to complete the same meaningful task through accessible alternatives.
2. **Safety before density:** pet identity, medication, health, money, and authorization controls remain clear under pressure.
3. **No sensory dependency:** color, shape, position, sound, motion, and imagery may reinforce meaning but may not carry it alone.
4. **Predictable behavior:** repeated components, navigation, labels, and help appear and behave consistently.
5. **Progressive disclosure:** smaller layouts prioritize the immediate task without hiding required information.
6. **User control:** users can zoom, resize text, reduce motion, dismiss nonessential overlays, and recover from errors.
7. **Privacy by presentation:** responsive designs must not expose more customer or pet information than the context requires.
8. **Accessible by default:** shared components prevent teams from repeatedly solving the same accessibility problem.

## 4. Supported interaction modes

Every applicable workflow must support:

- Keyboard-only operation.
- Pointer and touch operation.
- Browser zoom and text resizing.
- Screen readers and browser accessibility APIs.
- Voice-control software through visible labels that match accessible names.
- Windows high-contrast and forced-colors modes.
- Reduced-motion preferences.
- Portrait and landscape orientation unless a specific orientation is essential.

Support does not mean identical presentation. It means equivalent information, functionality, status, and recovery.

## 5. Responsive layout model

### 5.1 Content-driven ranges

Designs use content needs rather than named device models. The standard layout ranges are:

| Range | Indicative width | Typical treatment |
|---|---:|---|
| Compact | below 640 CSS px | Single-column flow, bottom or compact navigation, task-first cards |
| Medium | 640–1023 CSS px | Flexible columns, collapsible secondary regions |
| Wide | 1024–1439 CSS px | Persistent primary navigation and multi-column workspaces |
| Extra wide | 1440 CSS px and above | Constrained reading width, optional contextual panels, no uncontrolled stretching |

These values are implementation defaults, not reasons to hide functionality at a particular device width. Components should respond when their own available space becomes insufficient.

### 5.2 Reflow

- Content must reflow without loss of information or functionality at a width equivalent to 320 CSS pixels.
- Browser zoom to 400 percent must not require two-dimensional page scrolling except where a two-dimensional layout is essential to meaning or use.
- Long text wraps. Controls must not overlap, clip, or disappear.
- Fixed headers, footers, banners, and action bars must not obscure focused content.
- Reading content uses a reasonable maximum line length instead of filling an extra-wide display.
- Page-level horizontal scrolling is prohibited except for documented essential exceptions.

### 5.3 Essential two-dimensional content

Calendars, facility maps, timelines, charts, and large data grids may require two-dimensional presentation. When they do:

- Provide an equivalent list, agenda, summary, or detail view.
- Keep core actions available without drag-only interaction.
- Label the scrollable region and make its purpose clear.
- Preserve row and column context where practical.
- Do not force a customer to use a dense grid to complete a booking.

### 5.4 Responsive priority

When space contracts, adapt content in this order:

1. Preserve identity, status, risk, and primary action.
2. Stack related fields and actions.
3. Move secondary context into clearly labeled disclosure regions.
4. Replace tables with labeled records when comparison is not essential.
5. Provide an alternate view when the original visualization is inherently spatial.

Do not remove required warnings, prices, policy consequences, care instructions, or error recovery merely to simplify a compact layout.

### 5.5 Safe areas and virtual keyboards

- Fixed controls account for mobile safe-area insets.
- The on-screen keyboard must not cover the active field, error, or primary action.
- Forms scroll the focused field and its instructions into view without unexpected jumps.
- Bottom actions remain reachable and do not compete with browser or operating-system controls.

## 6. Typography, zoom, and spacing

- Body text remains readable at 200 percent text resize without loss of content or function.
- Users may override text spacing without clipping, overlap, or hidden controls.
- Do not disable pinch zoom or set a restrictive maximum scale.
- Use real text rather than images of text, except for essential brand marks.
- Avoid truncating safety-critical, financial, or legal text.
- When truncation is appropriate, the full value must be available by an accessible, non-hover-only method.
- Do not place critical instructions in placeholder text.
- Text should remain understandable when line wrapping changes labels, values, and buttons to multiple lines.

## 7. Color, contrast, and themes

### 7.1 Minimum contrast

- Normal text: at least 4.5:1 against its background.
- Large text: at least 3:1.
- Meaningful component boundaries, focus indicators, icons, and states: at least 3:1 against adjacent colors where WCAG non-text contrast applies.
- Disabled controls are exempt from some contrast criteria but must remain distinguishable from enabled controls.

### 7.2 Meaning and state

- Never communicate availability, health risk, overdue medication, payment state, or selection using color alone.
- Pair color with text, iconography, pattern, or another programmatically determinable state.
- Status wording must be explicit: use `Medication overdue`, not only a red dot.
- Charts use distinguishable labels, patterns, or direct annotations in addition to color.

### 7.3 Tenant branding

- The theme editor must validate text, component, focus, and status contrast before publishing.
- Unsafe color combinations are blocked or automatically corrected.
- Tenant colors may not override semantic danger, warning, success, and informational meaning without maintaining the platform rules.
- Custom logos require accessible alternative text or may be marked decorative when adjacent text supplies the name.
- The core product must remain usable in forced-colors mode.

## 8. Focus and keyboard operation

### 8.1 Focus order

- Focus follows the visual and semantic reading order.
- Responsive rearrangement must not create a contradictory focus sequence.
- Hidden and inert content must not receive focus.
- Opening a dialog moves focus into it; closing returns focus to the invoking control when it still exists.
- Route changes place focus at a logical page heading or managed route-announcement target.
- Validation failure moves focus to the error summary or first invalid field according to the documented form pattern.

### 8.2 Focus visibility

- Every interactive control has a visible focus indicator.
- Focus is never entirely obscured by sticky headers, banners, drawers, cookie notices, or action bars.
- PetCare’s component target is a clearly visible indicator comparable to a 2 CSS pixel perimeter with at least 3:1 contrast between focused and unfocused pixels.
- Focus styling must remain visible in high-contrast and forced-colors modes.
- Do not remove outlines without supplying an equal or stronger replacement.

### 8.3 Keyboard behavior

- All functionality available to a pointer is available by keyboard, except where the movement path itself is essential.
- No keyboard trap is permitted.
- `Tab` and `Shift+Tab` move between interactive components.
- Arrow-key behavior is reserved for composite widgets whose established pattern calls for it.
- `Escape` closes dismissible overlays when doing so does not discard unconfirmed critical work without warning.
- Single-character shortcuts are off, remappable, or active only when the relevant control has focus.
- Drag-and-drop features provide buttons, menus, or dialogs for moving the same object.

### 8.4 Skip and landmark navigation

- Each application shell provides a visible-on-focus skip link to main content.
- Pages use a single main landmark and meaningful navigation, search, banner, and complementary landmarks.
- Repeated landmark types receive unique accessible labels.
- Heading levels communicate page structure; headings are not selected merely for visual size.

## 9. Pointer and touch targets

WCAG 2.2 AA defines a 24 by 24 CSS pixel minimum target-size criterion with stated exceptions. PetCare adopts stronger defaults:

- Standard interactive targets should provide at least a 44 by 44 CSS pixel activation area.
- High-frequency operational and safety-critical targets should provide at least 48 by 48 CSS pixels when layout permits.
- Closely packed controls must have sufficient spacing to prevent accidental activation.
- Icon-only controls require an accessible name and a visible tooltip or adjacent label when their meaning is not universally clear.
- Destructive actions must not sit immediately beside frequent positive actions without separation or confirmation.
- Pointer cancellation and undo are preferred over irreversible action on pointer-down.

The larger PetCare sizes are product requirements; they do not replace formal WCAG evaluation.

## 10. Forms and data entry

### 10.1 Labels and instructions

- Every input has a persistent visible label and a programmatically associated accessible name.
- The visible label must be included in the accessible name.
- Required status is communicated in text and programmatically.
- Formatting expectations and units appear before submission.
- Appropriate autocomplete tokens, input modes, and native input types are used.
- Instructions are concise and located near the relevant control.

### 10.2 Errors and recovery

- Errors identify the field, explain the issue, and say how to correct it.
- Color alone never identifies an error.
- Multi-field forms provide an error summary linked to each invalid field.
- User-entered data remains intact after validation errors.
- Legal, financial, authorization, medication, and deletion actions support review, confirmation, correction, or reversal as appropriate.
- Asynchronous validation does not unexpectedly move focus or announce on every keystroke.
- Server errors provide a recovery path and a correlation reference when support may be needed.

### 10.3 Redundant entry and authentication

- Do not ask users to re-enter information already provided in the same process unless needed for security, accuracy, or the information is no longer valid.
- Authentication must support password managers and copy/paste.
- Do not require users to solve a cognitive-function test unless an accessible alternative is supplied.
- One-time codes use appropriate autocomplete and permit paste.
- Session expiry warnings allow extension when security policy permits.

## 11. Component interaction requirements

### 11.1 Buttons and links

- Use buttons for actions and links for navigation.
- Accessible names describe the action or destination in context.
- Repeated ambiguous text such as `View` must gain programmatic context.
- Disabled actions explain the unmet prerequisite when that information helps the user proceed.

### 11.2 Dialogs and drawers

- Dialogs have an accessible name and, when useful, a description.
- Modal focus is contained while open; background content is inert.
- A clear close control is available unless closure would bypass a required safety decision.
- Destructive confirmation names the affected record and consequence.
- Full-screen compact dialogs preserve the same semantics and focus behavior as desktop dialogs.
- Drawers do not become accidental modals; modality must match actual behavior.

### 11.3 Menus, tabs, disclosure, and accordions

- Standard navigation lists are not converted into ARIA menus without menu behavior.
- Tabs implement the expected tablist, tab, and tabpanel relationships and keyboard behavior.
- Disclosure controls communicate expanded state.
- Accordion headings remain headings and contain their disclosure button.
- Hidden panels are removed from the accessibility tree and focus order.

### 11.4 Tooltips, popovers, and hover content

- Essential information is never available only on hover.
- Hover or focus content is dismissible, hoverable, and persistent long enough to use.
- Tooltips do not contain interactive controls; use a popover or dialog when interaction is required.
- Compact and touch layouts provide a tap or inline path to the same information.

### 11.5 Comboboxes and selectors

- Prefer native selects for simple option lists.
- Custom comboboxes expose name, role, value, expanded state, active option, and keyboard behavior.
- Search results and result counts are announced without excessive repetition.
- Multi-select controls present selected items in a readable, removable list.
- Business, customer, and pet selectors show enough distinguishing information without exposing unnecessary private data.

### 11.6 Tables and data grids

- Use semantic tables for read-only tabular data.
- Header associations remain programmatically available.
- Sorting controls announce the column and current direction.
- Responsive record-card alternatives preserve every required value and action.
- Use an interactive grid only when cell-level keyboard interaction is genuinely required.
- Virtualized rows must preserve accessible position, count, focus, and reading behavior.
- Bulk actions clearly announce selection counts and scope.

### 11.7 Calendars and schedulers

- Every calendar has an agenda or list alternative.
- Dates include unambiguous accessible names with day, month, date, and year where relevant.
- Availability is conveyed with text, not color alone.
- Keyboard users can navigate dates, select ranges, and escape the widget.
- Disabled dates explain why they are unavailable when the reason may affect the user’s decision.
- Time zones and daylight-saving effects are visible where multiple locations or remote users make them relevant.

### 11.8 Toasts and notifications

- Status messages are announced using the least disruptive appropriate live-region behavior.
- Critical alerts that require action persist in an alert center or page state; they do not vanish only as a toast.
- Repeated progress updates are throttled to avoid overwhelming assistive-technology users.
- Focus is not moved to a toast.
- Actions inside temporary messages remain available elsewhere or pause dismissal while focused.

## 12. Media, documents, and signatures

- Informative images have concise alternative text based on purpose.
- Decorative images use empty alternative text.
- Pet photos may assist recognition but never replace the pet’s name and other required identity data.
- Before-and-after grooming photos, incident evidence, and vaccination documents require context outside the image.
- Prerecorded video requires captions; audio description or a text alternative is supplied when visual information is necessary.
- Camera capture has a file-upload alternative where the workflow permits.
- Document previews do not replace an accessible text or downloadable document path.
- Signature interfaces must provide a keyboard-accessible method and clearly identify the agreement being signed.

## 13. Motion, animation, and time

- Honor `prefers-reduced-motion` and remove nonessential movement.
- Avoid flashing content and unsafe animation frequencies.
- Auto-updating carousels, tickers, and promotional motion are paused by default or provide controls.
- Animation must not be necessary to understand state change.
- Capacity holds, checkout timers, session expiry, and operational countdowns announce their purpose and remaining time without constant interruption.
- When a time limit is essential, explain why. Otherwise, permit turning it off, adjusting it, or extending it.
- Auto-refresh must preserve focus, unsaved work, and the user’s reading position.

## 14. Charts, maps, and visual dashboards

- Each chart has a clear title, metric definition, period, and accessible summary.
- Exact values are available in a table or structured list.
- Tooltips are keyboard and touch accessible when they contain useful values.
- Patterns, labels, and direct annotation supplement color.
- Trend descriptions do not claim causation without evidence.
- Facility maps provide a list-based resource and status view.
- A kennel map must not be the only way to assign, inspect, or release a resource.
- Dashboard responsive layouts preserve filter scope and freshness indicators.

## 15. Pet-care safety interactions

### 15.1 Identity

- Safety-critical screens show pet name plus at least one additional approved identifier.
- Photos reinforce identity but are never the only identifier.
- Similar names receive a visible disambiguation treatment.
- Household and sibling relationships must not cause the wrong pet’s care plan to be applied.

### 15.2 Medication and care tasks

- Medication interfaces expose drug, dose, route, scheduled window, pet identity, and status as text.
- Overdue and exception states remain persistent and programmatically determinable.
- Completion controls require deliberate activation and support correction with audit history.
- Safety warnings interrupt only when immediate attention is justified.
- Dense task lists have a compact alternative that still preserves risk, due time, and pet identity.

### 15.3 Check-in and checkout

- Staff can use a customer-review mode without exposing unrelated customers or internal notes.
- Pickup authorization is never conveyed only by badge color or photo.
- Belongings, medications, balances, and unresolved holds appear as labeled checklist items.
- Signatures, payments, and confirmations remain usable with keyboard, touch, zoom, and screen readers.

### 15.4 Shared operational devices

- Focus, zoom, text size, and contrast choices must not break workstation workflows.
- Privacy-sensitive content is minimized in queue and board views.
- Automatic lock and handoff behavior must not erase completed work or silently submit incomplete work.
- Large touch targets are favored for fast-paced staff workflows.

## 16. Navigation and route behavior

- Navigation destinations and ordering remain consistent across responsive variants.
- Compact navigation may change presentation but not terminology or permission meaning.
- Current location is visually and programmatically indicated.
- Breadcrumbs use semantic navigation and indicate the current page.
- Back behavior returns users to a predictable prior context and preserves filters when appropriate.
- Deep links load with a meaningful page title, heading, and focus position.
- Unsaved changes are protected before route or browser navigation.

## 17. Localization and content resilience

- Layouts tolerate at least 30 percent text expansion and longer labels without clipping.
- Do not concatenate translated fragments into sentences.
- Dates, times, numbers, currency, names, addresses, and plural forms use locale-aware formatting.
- Language changes are identified programmatically.
- Icons and gestures are reviewed for cultural meaning.
- Right-to-left readiness must be considered in component structure even if not in the first release.
- Plain language is favored for customer instructions, errors, policies, and consent.

## 18. Implementation conventions

### 18.1 Shared components

- Product teams must use the approved shared component when one exists.
- Components expose accessible names, descriptions, error links, and focus refs without requiring unsafe workarounds.
- Responsive variants share semantics and data even when presentation differs.
- Component stories include default, hover, focus, active, disabled, loading, error, empty, high-contrast, reduced-motion, compact, and long-content states as applicable.
- Breaking accessibility behavior is treated as a component regression affecting every consumer.

### 18.2 Rendering and routing

- Server-rendered and hydrated content must preserve semantic order.
- Loading placeholders must not create misleading accessible content or excessive announcements.
- Route transitions announce the new page without duplicating the entire page.
- Focus restoration is explicit for dialogs, drawers, pagination, and asynchronous mutations.
- DOM order should match the meaningful visual order; CSS reordering must not create contradictory reading behavior.

### 18.3 Third-party components

- Third-party calendars, payments, maps, editors, chat, uploaders, and analytics controls require accessibility review before adoption.
- Vendor claims do not replace PetCare testing.
- An accessible fallback and exit path must exist for any embedded service that cannot meet the baseline.
- Contract and upgrade reviews include accessibility regressions and remediation responsibility.

## 19. Testing standard

W3C notes that automated tools cannot determine conformance by themselves; knowledgeable human evaluation is required. PetCare therefore uses layered testing.

### 19.1 Automated checks

At minimum:

- Static analysis for invalid or missing accessibility attributes.
- Automated browser checks for detectable WCAG failures.
- Color-contrast checks for product and tenant themes.
- Component regression tests for names, roles, states, keyboard paths, and focus behavior.
- Responsive visual checks across representative widths and text expansion.

Automated results are evidence, not a conformance certificate.

### 19.2 Required manual checks

Every significant journey must be tested for:

- Complete keyboard-only operation.
- Visible and unobscured focus.
- Logical reading and focus order.
- Screen-reader names, roles, states, announcements, and error recovery.
- Touch target size and compact-layout usability.
- 200 percent text resize and 400 percent browser zoom.
- 320 CSS pixel reflow.
- Forced-colors/high-contrast behavior.
- Reduced motion.
- Portrait and landscape behavior where supported.
- Long content, localization expansion, empty states, errors, and slow network behavior.

### 19.3 Assistive-technology matrix

The maintained QA matrix must include representative, supported combinations across:

- Windows screen reader and current Chromium-based browser.
- Apple screen reader and Safari on macOS.
- Apple screen reader and Safari on iOS.
- Android screen reader and current Chrome.

The exact supported versions belong in the release test matrix because browser and assistive-technology versions change. Passing one combination does not prove universal conformance.

### 19.4 User evaluation

High-impact customer and staff workflows should include evaluation with people with disabilities. User research supplements, but does not replace, WCAG conformance evaluation.

## 20. Release gates

A release candidate is blocked when it contains:

- A keyboard trap or inaccessible required action.
- Missing accessible names on required controls.
- Focus loss that prevents task completion.
- Safety-critical meaning conveyed only by color, photo, location, sound, or motion.
- A customer payment, agreement, booking, or authentication flow that cannot be completed with supported assistive technology.
- A staff care, medication, check-in, or checkout flow that cannot be completed at supported zoom or compact width.
- A critical contrast failure in platform or tenant themes.
- Unannounced errors that prevent completion.
- Page-level two-dimensional scrolling that is not an approved essential exception.

Lower-severity defects require an owner, impact assessment, target release, and documented workaround before approval.

## 21. Accessibility exception process

An exception must document:

1. The affected surface, component, and users.
2. The specific standard or product requirement not met.
3. Why the limitation exists.
4. The accessible alternative or temporary workaround.
5. Risk to safety, privacy, money, and task completion.
6. Responsible owner and remediation date.
7. Approval from product, engineering, quality, and accessibility ownership.

Exceptions may not silently become permanent. Safety-critical and core customer flows should not launch with unresolved blockers.

## 22. Definition of done

A screen or journey is complete only when:

- It uses approved semantic components.
- Compact, medium, wide, zoomed, and long-content layouts are verified.
- Keyboard and focus behavior is documented and tested.
- Accessible names, descriptions, states, errors, and status announcements are verified.
- Contrast and non-color meaning are verified across supported themes.
- Drag, hover, gesture, image, sound, and spatial interactions have accessible alternatives.
- Automated checks pass and required manual checks are recorded.
- Known exceptions follow the exception process.
- Acceptance tests cover responsive and accessibility behavior, not merely visual snapshots.

## 23. Required acceptance scenarios

Each applicable module must adapt these scenarios:

1. A customer completes registration and booking at 400 percent browser zoom using only a keyboard.
2. A customer corrects multiple validation errors without re-entering valid information.
3. A screen-reader user identifies unavailable dates, prices, and policy consequences in booking.
4. A staff member completes a care task on a compact touch display without activating an adjacent action.
5. A keyboard user opens and closes a dialog and returns to the correct invoking control.
6. A staff member identifies a pet without relying on its photo or status color.
7. A user accesses calendar information through an agenda/list alternative.
8. A tenant selects low-contrast brand colors and the system blocks or corrects publication.
9. A user with reduced motion enabled receives all status information without nonessential animation.
10. A high-contrast-mode user can distinguish focus, selection, errors, and disabled state.
11. A session or capacity hold warning is announced and can be extended where policy permits.
12. An asynchronous save succeeds or fails without losing focus, data, or recovery information.

## 24. Ownership

- **Design system owners:** component semantics, tokens, interaction patterns, theme validation, and usage guidance.
- **Feature teams:** correct use, journey-level behavior, content, testing, and remediation.
- **Quality:** automated and manual test strategy, evidence, release gates, and regression coverage.
- **Product:** prioritization, equivalent outcomes, exception risk, and accessible acceptance criteria.
- **Security:** authentication, session, privacy, and fraud controls that preserve accessibility.
- **Tenant platform:** safe branding and configuration constraints.
- **Support:** accessible issue intake, workaround documentation, and escalation.

## 25. Open decisions

These require explicit decisions before the related implementation:

- Supported browser and assistive-technology version matrix.
- Accessibility ownership model and review cadence.
- Approved automated testing stack and CI thresholds.
- Tenant theme correction behavior versus publication blocking.
- Standard agenda/list alternatives for calendar and facility-map components.
- Accessibility statement, feedback channel, and response SLA.
- Requirements for accessible PDFs and customer-generated documents.
- Localization and right-to-left release milestones.

## 26. Related PetCare documents

- [Design system foundation](design-system.md)
- [Information architecture and navigation](information-architecture.md)
- [Customer booking journey](customer-booking-journey.md)
- [Check-in and checkout journey](check-in-checkout-journey.md)
- [Daily care and service-execution journey](daily-care-service-execution-journey.md)
- [Business onboarding journey](business-onboarding-journey.md)
- [Identity and Access domain](../domains/identity-access/README.md)
- [Operations domain](../domains/operations/README.md)
- [Website and Content domain](../domains/website-content/README.md)
- [Design system foundation requirement](../requirements/documentation-backlog.md)

## 27. Authoritative external references

- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [APG introduction and scope](https://www.w3.org/WAI/ARIA/apg/about/introduction/)
- [W3C evaluating web accessibility overview](https://www.w3.org/WAI/test-evaluate/)
- [W3C guidance on involving users in accessibility evaluation](https://www.w3.org/WAI/test-evaluate/involving-users/)

