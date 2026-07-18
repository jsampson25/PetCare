# Design System Foundation

- **Status:** In progress
- **MVP priority:** P0
- **Implementation direction:** Tailwind CSS, shadcn/ui, Radix primitives, React, and TypeScript
- **Accessibility target:** WCAG 2.2 AA

## Purpose

The PetCare design system provides one visual language, interaction model, and component contract for the public website, booking flow, customer portal, business portal, staff operations, and Platform Console. It keeps the product coherent while allowing controlled tenant branding on customer-facing surfaces.

This foundation defines tokens, components, states, patterns, responsive behavior, accessibility, and governance. It does not prescribe a final marketing brand or replace screen-level UX specifications.

## Design goals

- Make time-sensitive care work fast and safe.
- Make customer experiences calm, friendly, and trustworthy.
- Keep dense business information understandable without feeling dated.
- Give status and risk a consistent meaning throughout the product.
- Support touch, keyboard, mouse, assistive technology, zoom, and responsive layouts.
- Allow a tenant's brand to feel present without weakening usability or platform consistency.
- Build components once and reuse them across every domain.
- Make invalid, loading, empty, partial, offline, and failed states first-class design work.

## Product visual character

The platform should feel:

- Modern but not trendy at the expense of longevity
- Friendly but not childish
- Operational but not industrial
- Premium but not exclusive
- Calm during normal work and unmistakable during urgent conditions
- Spacious enough to scan, compact enough for real daily workloads

Avoid ornamental dashboards, excessive gradients, glass effects, tiny gray text, ambiguous icon-only actions, and large cards that hide operational density.

## Surface strategy

| Surface          | Visual strategy                                           | Tenant branding                                       |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Public website   | Light, editorial, image-forward, responsive               | Strong within accessible theme controls               |
| Booking flow     | Light, focused, low-distraction                           | Logo, brand action color, approved typography accents |
| Customer Portal  | Light, calm, card-and-list based                          | Moderate and continuous with booking                  |
| Business Portal  | Neutral operational shell with higher information density | Tenant logo/name, limited accent use                  |
| Staff Operations | High-clarity task and exception interface                 | Minimal branding; safety semantics dominate           |
| Platform Console | Distinct privileged operational shell                     | No tenant visual impersonation                        |

Dark mode is not an MVP requirement. Components must use semantic tokens rather than hard-coded light values so a future dark or high-contrast theme can be added without rewriting component logic.

## Token architecture

Tokens are layered:

```text
Primitive tokens
  -> Semantic tokens
  -> Component tokens
  -> Approved tenant theme overrides
```

- **Primitive tokens** describe raw color, size, and type values.
- **Semantic tokens** describe purpose such as background, text, border, danger, or focus.
- **Component tokens** apply semantic values to specific components.
- **Tenant overrides** may change only approved customer-facing semantic tokens.

Application code uses semantic or component tokens. Raw palette values are confined to the token definitions and visual tooling.

## Color system

### Neutral roles

| Token               | Use                                           |
| ------------------- | --------------------------------------------- |
| `--surface-canvas`  | Application or page background                |
| `--surface-default` | Primary card, panel, form, and table surface  |
| `--surface-subtle`  | Secondary grouped content and quiet emphasis  |
| `--surface-raised`  | Menus, popovers, dialogs, and elevated panels |
| `--surface-inverse` | Rare high-contrast inverse surface            |
| `--text-primary`    | Main content and controls                     |
| `--text-secondary`  | Supporting content                            |
| `--text-muted`      | Metadata that remains legible                 |
| `--text-inverse`    | Text on inverse surfaces                      |
| `--border-default`  | Standard boundaries                           |
| `--border-strong`   | Emphasized boundaries and table structure     |
| `--border-subtle`   | Low-emphasis separators                       |

Muted text still meets required contrast for its size and use. Placeholder text is not used as a substitute for a visible field label.

### Brand and action roles

| Token                     | Use                                                   |
| ------------------------- | ----------------------------------------------------- |
| `--action-primary`        | Primary action background or key interactive emphasis |
| `--action-primary-hover`  | Hover state                                           |
| `--action-primary-active` | Pressed state                                         |
| `--action-primary-text`   | Text/icon on primary action                           |
| `--action-secondary`      | Secondary action surface                              |
| `--focus-ring`            | Keyboard focus indicator                              |
| `--link-default`          | Inline and standalone links                           |
| `--selection`             | Text or item selection highlight                      |

Tenant themes may influence approved customer-facing action and link tokens after contrast validation. Safety colors never inherit tenant branding.

### Semantic status roles

| Meaning       | Tokens        | Examples                                             |
| ------------- | ------------- | ---------------------------------------------------- |
| Informational | `--info-*`    | Pending review, guidance, neutral update             |
| Success       | `--success-*` | Completed, verified, paid, ready                     |
| Warning       | `--warning-*` | Expiring vaccine, balance due, nearing capacity      |
| Danger        | `--danger-*`  | Missed medication, failed payment, critical incident |
| Neutral       | `--neutral-*` | Draft, inactive, archived, not applicable            |

Each family defines background, foreground, border, icon, and strong/action values. Status is always reinforced by label and, where useful, icon—not color alone.

### Operational urgency

Urgency and record status are separate properties.

| Urgency   | Meaning                                      | Presentation                                       |
| --------- | -------------------------------------------- | -------------------------------------------------- |
| None      | No time-sensitive action                     | Standard presentation                              |
| Attention | Action should be reviewed                    | Quiet warning emphasis                             |
| Due soon  | Deadline approaching                         | Warning plus due time                              |
| Overdue   | Required action is late                      | Danger emphasis plus elapsed time                  |
| Critical  | Immediate safety or severe business response | Strong danger treatment, persistent until resolved |

A completed task cannot remain visually `critical` solely because it was previously late; its history records lateness while current state shows completion.

## Typography

### Font strategy

- Platform UI uses one highly legible sans-serif variable font or system-safe stack.
- Tenant public themes may select from a small approved pairing catalog.
- Operational data, amounts, times, and identifiers use tabular numerals where alignment matters.
- Code, webhook IDs, and technical references use a monospace token sparingly.

### Type scale

| Token        | Desktop intent | Mobile intent | Typical use                                     |
| ------------ | -------------- | ------------- | ----------------------------------------------- |
| `display-lg` | 48/56          | 36/44         | Public homepage hero only                       |
| `display-sm` | 40/48          | 32/40         | Public campaign heading                         |
| `heading-1`  | 32/40          | 28/36         | Page title                                      |
| `heading-2`  | 24/32          | 22/30         | Major section                                   |
| `heading-3`  | 20/28          | 18/26         | Card or subgroup heading                        |
| `body-lg`    | 18/28          | 18/28         | Public lead copy, important explanation         |
| `body-md`    | 16/24          | 16/24         | Default body and form input                     |
| `body-sm`    | 14/20          | 14/20         | Tables, metadata, secondary UI                  |
| `label-md`   | 14/20          | 14/20         | Field and control labels                        |
| `label-sm`   | 12/16          | 12/16         | Badges and compact labels; never critical prose |

The exact font size may be implemented with rem units. User browser font scaling and zoom remain functional. Heading appearance does not determine HTML heading level; semantic document structure does.

### Typography rules

- Body text does not fall below 14px-equivalent in application UI.
- Customer forms use at least 16px-equivalent input text to avoid mobile zoom behavior.
- Line lengths target roughly 45–80 characters for prose.
- All-caps is limited to short nonessential labels and never used for full sentences.
- Buttons use sentence case and action-oriented labels.
- Truncation is a last resort; critical names, medication, dose, date, status, and balance remain recoverable.
- Dates, times, currency, and numbers follow tenant locale while preserving unambiguous operational meaning.

## Spacing

The spacing scale uses a 4px base rhythm:

| Token      | Value | Common use                    |
| ---------- | ----: | ----------------------------- |
| `space-0`  |     0 | No spacing                    |
| `space-1`  |   4px | Icon-to-label micro gap       |
| `space-2`  |   8px | Compact control gap           |
| `space-3`  |  12px | Related field/content gap     |
| `space-4`  |  16px | Default component padding     |
| `space-5`  |  20px | Comfortable component padding |
| `space-6`  |  24px | Card and section spacing      |
| `space-8`  |  32px | Major application section     |
| `space-10` |  40px | Public content section        |
| `space-12` |  48px | Large section separation      |
| `space-16` |  64px | Public page vertical rhythm   |
| `space-20` |  80px | Large marketing section       |

Use fewer spacing values within one component. Dense operational modes reduce padding through component variants, not ad hoc negative margins.

## Sizing and touch targets

| Token        | Value | Use                                      |
| ------------ | ----: | ---------------------------------------- |
| `control-sm` |  32px | Dense desktop-only secondary controls    |
| `control-md` |  40px | Default desktop control                  |
| `control-lg` |  48px | Customer/mobile primary control          |
| `touch-min`  |  44px | Minimum pointer target in general use    |
| `touch-care` |  48px | Preferred target in staff care workflows |

Adjacent touch targets include enough separation to prevent accidental medication, incident, payment, or destructive actions.

## Shape, borders, and elevation

### Radius

| Token         | Use                                    |
| ------------- | -------------------------------------- |
| `radius-sm`   | Badges, compact controls               |
| `radius-md`   | Inputs, buttons, table containers      |
| `radius-lg`   | Cards, panels, dialogs                 |
| `radius-xl`   | Public marketing media and hero panels |
| `radius-full` | Avatars and true pill controls         |

Pill shapes are not used for ordinary buttons or every status. Tenant branding may choose among approved radius presets, not arbitrary values.

### Border

- One-pixel semantic borders define most component boundaries.
- Strong borders indicate selection, grouping, or high-value separation.
- Error borders are paired with message and icon.
- Dividers do not replace proper spacing and headings.

### Elevation

| Level         | Use                           |
| ------------- | ----------------------------- |
| `elevation-0` | Inline page content           |
| `elevation-1` | Raised card or sticky toolbar |
| `elevation-2` | Popover, menu, hover card     |
| `elevation-3` | Dialog, command palette       |
| `elevation-4` | Rare critical overlay         |

Elevation combines shadow, border, and surface token. Shadows are subtle and are never the only boundary.

## Iconography

- Use one consistent outline icon family compatible with shadcn/ui.
- Default sizes are 16, 20, and 24px.
- Icons accompanying text are decorative unless they convey unique information.
- Icon-only buttons require accessible names and visible tooltips for unfamiliar actions.
- Destructive, medication, incident, payment, and security icons are never ambiguous.
- Pet photos or species imagery are not used as icons for operational status.
- Tenant logos do not replace the platform or product identity in privileged shells.

## Motion

Motion communicates state and relationship; it is not decoration.

- Fast feedback: 100–150ms
- Standard transition: 150–250ms
- Complex enter/exit: up to 300ms
- Avoid long page-load animations and bouncing attention effects.
- Respect `prefers-reduced-motion` and remove nonessential movement.
- Do not animate critical content in a way that delays access.
- Loading indicators do not create layout shift.

## Layout system

### Breakpoint intent

Breakpoints follow content needs rather than device brands:

| Range      | Intent                                                     |
| ---------- | ---------------------------------------------------------- |
| Compact    | Phone and narrow embedded layouts                          |
| Medium     | Tablet and split-view layouts                              |
| Wide       | Desktop application and public page layouts                |
| Extra wide | High-density boards and reports with bounded content width |

Implementation may map these to Tailwind breakpoints after prototype testing.

### Page widths

- Public prose uses a readable max width.
- Public marketing sections use a wider bounded container.
- Customer forms use a focused narrow-to-medium column.
- Business object pages use a responsive wide container.
- Operational boards may use the full available width.
- Platform Console uses a wide but structured workspace.

### Grid

- Compact: four conceptual columns with 16px outer margin
- Medium: eight columns with 24px outer margin
- Wide: twelve columns with 24–32px outer margin
- Gutter and container values use spacing tokens.
- Components reflow, reorder, or change view mode; they do not merely shrink.

## Density

The design system supports two controlled application densities:

| Density     | Use                                                    |
| ----------- | ------------------------------------------------------ |
| Comfortable | Customer Portal, configuration, standard object detail |
| Compact     | Desktop tables, schedules, worklists, reporting        |

Critical mobile care workflows use comfortable touch sizing even if the desktop equivalent is compact. Density changes spacing and row height, not font legibility or target safety.

## Component architecture

Components are organized in four levels:

1. **Primitives:** button, input, label, icon, separator, surface
2. **Composites:** field, select, date picker, alert, card, table, tabs
3. **Patterns:** filter bar, object header, worklist item, status timeline, form section
4. **Domain assemblies:** booking summary, medication task, pet identity header, invoice summary

Domain assemblies compose shared components and remain owned by their domain. They do not fork primitive behavior.

## Core component inventory

### Actions

- Button
- Icon button
- Split button only where action relationship is clear
- Button group
- Link
- Menu and menu item
- Command/create launcher

### Inputs

- Text, email, telephone, password, number, and currency input
- Textarea
- Checkbox
- Radio group
- Switch for immediate binary settings only
- Select and combobox
- Multi-select
- Date picker
- Date range picker
- Time input and time-window input
- File uploader
- Search input
- Address input
- Quantity and stepper control

### Feedback

- Inline validation
- Alert
- Callout
- Toast
- Banner
- Progress indicator
- Skeleton
- Empty state
- Error state
- Offline/stale state
- Tooltip

### Navigation

- Global header
- Sidebar
- Mobile navigation
- Breadcrumbs
- Tabs
- Pagination
- Stepper
- Anchor/section navigation
- Tenant and location selector

### Data display

- Card
- Stat/KPI card
- Description list
- Table and data grid
- List and worklist
- Badge/status chip
- Avatar and pet photo
- Timeline
- Calendar
- Capacity indicator
- Progress meter
- Chart container
- Media gallery

### Overlays

- Dialog
- Alert dialog
- Drawer/sheet
- Popover
- Dropdown menu
- Hover card
- Command palette

### Operational patterns

- Pet identity header
- Customer identity header
- Booking status header
- Care alert strip
- Due task row/card
- Medication administration panel
- Feeding completion panel
- Arrival/departure card
- Resource assignment card
- Incident severity panel
- Payment blocker
- Publication readiness panel

## Component contract

Every reusable component documents:

- Purpose and when not to use it
- Anatomy and supported variants
- Semantic token usage
- Required and optional props
- Keyboard behavior
- Accessible name and description behavior
- Loading, empty, disabled, read-only, invalid, and error states
- Responsive behavior
- Content guidelines
- Analytics events where material
- Visual regression examples
- Unit, accessibility, and interaction test expectations

Component APIs expose intent, not styling escape hatches. For example, use `tone="danger"` rather than passing a raw red class.

## Buttons

### Variants

| Variant     | Use                                                |
| ----------- | -------------------------------------------------- |
| Primary     | One main action in a region                        |
| Secondary   | Important alternative or supporting action         |
| Quiet       | Low-emphasis action in dense interfaces            |
| Destructive | Action with harmful or hard-to-reverse consequence |
| Link        | Navigation or low-emphasis inline action           |

### Rules

- Use verbs: `Save changes`, `Confirm booking`, `Record medication`.
- Do not use `Yes` or `OK` when the consequence can be named.
- A page may have multiple workflow actions but one visually dominant primary action per action region.
- Loading preserves button width and prevents duplicate submission.
- Disabled buttons are not used to hide the reason; explain missing requirements nearby.
- Destructive actions use consequence-specific confirmation.
- `Cancel` dismisses a dialog; booking cancellation is labeled `Cancel booking`.

## Forms

### Field anatomy

```text
Label
Optional hint or requirement
Control
Validation or supporting message
```

### Rules

- Labels remain visible after entry.
- Required fields are indicated consistently; do not mark nearly every field with an unexplained asterisk.
- Validation occurs at useful moments without punishing incomplete typing.
- Submit validates the whole form and moves focus to an error summary.
- Inline errors identify the problem and correction.
- Preserve valid data after an error.
- Group related fields with a heading and explanatory text.
- Long settings pages use sections and saved-state feedback.
- Auto-save is used only when partial state and conflict behavior are safe and obvious.
- Sensitive inputs identify why data is needed and who can see it.

### Read-only and disabled

- **Read-only** means the value is available but cannot be edited in the current context.
- **Disabled** means the control is not currently applicable or available.
- A disabled field is not used to present essential information because disabled contrast may be lower.

## Validation language

Use direct, specific wording:

- Good: `Enter a pickup time after 3:00 PM.`
- Good: `Rabies vaccination expires before this stay ends.`
- Good: `This kennel is already assigned during the selected dates.`
- Avoid: `Invalid input.`
- Avoid: `Something went wrong.` when a safe actionable reason is known.

System failures use a correlation reference only when it helps support and does not overwhelm the user.

## Tables and data grids

### When to use

Use tables for comparable records with repeated fields. Use cards or lists when each item needs substantially different actions, narrative, or mobile presentation.

### Required behavior

- Clear column headers
- Keyboard-accessible sorting and selection
- Visible active sort and filters
- Pagination or virtualized loading with total/position context
- Loading skeleton aligned to columns
- Empty and filtered-no-result states
- Responsive transformation to a purposeful list when columns cannot fit
- Sticky headers only when they do not obscure focus or content
- Row actions available without hover
- Bulk actions show selection count and scope
- Export reflects server-side filters, not only loaded rows

Amounts align by decimal; dates and statuses remain scannable. Critical names and alerts are not truncated without an accessible way to reveal them.

## Cards

Cards group one coherent concept or action. They are not a universal wrapper.

- Use a visible heading when content needs one.
- Do not nest multiple card levels without clear hierarchy.
- A clickable card has one primary destination; embedded buttons require unambiguous interaction.
- KPI cards include definition access, time basis, and freshness where applicable.
- Operational cards prioritize pet identity, due time, status, and next action.

## Status badges and chips

### Status badge

Communicates a system or object state such as `Confirmed`, `In care`, `Overdue`, or `Refunded`.

### Filter chip

Represents an interactive filter or removable selection.

### Tag

Represents tenant-configured classification such as `VIP` or `Needs quiet area` and must not visually imitate a verified safety or financial status.

These components are visually and semantically distinct.

## Alerts, banners, and toasts

| Pattern       | Use                                            | Persistence                                 |
| ------------- | ---------------------------------------------- | ------------------------------------------- |
| Inline alert  | Contextual problem within a form/object        | Until resolved or dismissed when allowed    |
| Page banner   | Page-wide status or dependency issue           | Persistent while relevant                   |
| Global banner | Tenant/platform condition affecting many pages | Persistent and centrally controlled         |
| Toast         | Confirmation of a completed low-risk action    | Temporary, with history elsewhere if needed |

Never use a transient toast as the only evidence of a payment failure, medication exception, incident, unsaved conflict, or destructive action.

## Dialogs and confirmation

Dialogs are used for focused decisions or short tasks, not entire complex workflows.

### Confirmation levels

| Risk                  | Pattern                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| Reversible low risk   | Direct action plus undo when safe                                                  |
| Moderate consequence  | Confirmation with concise impact                                                   |
| High risk             | Alert dialog with object, consequence, reason, and step-up if required             |
| Critical/irreversible | Dedicated flow, explicit identifiers, approval, and audit—not a small dialog alone |

Focus moves into the dialog, remains trapped appropriately, and returns to the invoking control after close. Escape and close behavior cannot accidentally abandon completed high-risk changes.

## Tabs

- Tabs switch peer views within one object or workspace.
- Tab state may be addressable by route for major object sections.
- Tabs are not used as sequential form steps.
- Mobile tabs scroll or transform without hiding labels behind ambiguous icons.
- Counts in tabs use accessible labels and do not become the only alert signal.

## Stepper

The stepper is used for booking, onboarding, check-in, checkout, and other sequential flows.

- Shows current, completed, and future steps.
- Future steps are not clickable unless the workflow supports safe non-linear navigation.
- Back navigation preserves valid data.
- Conditional steps appear predictably and are announced.
- Error summary identifies the step requiring correction.
- Mobile uses concise labels and a textual `Step X of Y` equivalent.

## Object header

Customer, pet, booking, invoice, stay, and tenant pages share an object-header contract:

- Object identity and secondary identifier
- Current status
- Tenant/location context
- Critical alerts or blockers
- Key metadata
- Primary valid action
- Secondary actions
- Breadcrumb or return context

The header adapts to screen size but never hides critical pet identity, booking status, location, or operational risk.

## Pet identity pattern

Pet identity is safety-critical.

Include where relevant:

- Current photo or clear fallback
- Pet name
- Species and breed/mix
- Size/weight where operationally relevant
- Age or birth date where relevant
- Sex and altered status where permitted
- Owner/household summary
- Critical medical, allergy, behavior, or handling alerts
- Current booking/stay and housing assignment

Never rely on photo alone. Similar pet names require additional identifying context. Critical alerts use clear labels and are not hidden behind hover.

## Care task pattern

A care task presents:

- Pet identity
- Task type
- Due time/window and urgency
- Exact instruction summary
- Dependencies, holds, or alerts
- Assigned role/person when relevant
- Allowed outcomes
- Completion evidence requirements

Medication tasks include medication, dose, route, scheduled time, relevant food dependency, and witness requirement. A generic checkbox is insufficient.

## Calendar and scheduling

- Use color as a secondary cue, never the sole service/status distinction.
- Provide agenda/list alternatives.
- Show current time and location time zone.
- Distinguish overnight spans, attendance days, and timed appointments.
- Capacity is not represented as simple free/busy when quantity matters.
- Keyboard users can navigate dates and open items.
- Drag-and-drop, when introduced, has a non-drag alternative and full conflict/price/notification confirmation.
- Loading or stale availability is visible.

## Timeline

Timelines display immutable or revisioned events in chronological order.

- Show timestamp with applicable time zone.
- Show actor and source.
- Group routine events without hiding critical exceptions.
- Corrections point to the original event.
- Filters do not change the underlying audit history.
- Customer-visible timelines exclude internal events according to domain policy.

## File upload

- Use explicit accepted type and size guidance.
- Show progress, processing, success, rejection, and retry.
- Do not mark a file complete before validation/scanning finishes.
- Require document type and expiration when relevant.
- Image uploads support crop only when the original remains safely managed.
- Alternative text is required for meaningful public media.
- Errors identify the failed file in a multi-file group.

## Loading and progress

| Pattern          | Use                                    |
| ---------------- | -------------------------------------- |
| Skeleton         | Predictable content layout loading     |
| Spinner          | Small indeterminate localized action   |
| Progress bar     | Measurable upload, import, or workflow |
| Status page/card | Long-running asynchronous job          |

Avoid full-screen blocking for unrelated background work. Optimistic updates are used only when rollback is clear and no financial, safety, or capacity conflict can be hidden.

## Empty states

Empty states contain:

- What belongs here
- Why it may be empty
- The next permitted action
- Relevant setup or filter context

Types include first-use, completed work, filtered no results, permission-limited, dependency blocked, and archived-only. They do not all share the same illustration or wording.

## Error and recovery states

Errors are classified:

| Class           | User experience                                                          |
| --------------- | ------------------------------------------------------------------------ |
| Validation      | Explain the specific field or rule and retain valid input                |
| Conflict        | Show what changed and offer refresh/review/retry choices                 |
| Permission      | Explain that access is unavailable without revealing protected existence |
| Dependency      | Identify the unavailable capability and safe fallback                    |
| Offline/network | Preserve safe draft state and distinguish unsynced work                  |
| System          | Provide retry/support path and trace reference when useful               |

Never report a failed payment, booking, medication record, or check-in as successful because the local UI updated optimistically.

## Content and voice

### Voice

- Clear
- Calm
- Direct
- Respectful
- Human
- Specific about consequence

### Terminology

- Use `pet`, not `animal`, in ordinary customer and operational UI unless legal/clinical context requires otherwise.
- Use the tenant-configured resource label such as `suite` or `kennel`, with stable internal semantics.
- Use `booking` consistently; use `appointment` for timed services when useful.
- Use `customer` in staff UI and `you/your household` in customer UI.
- Use `record medication`, not `complete medication`, when the workflow captures an administration outcome.
- Use `payment failed`, `refund pending`, and `invoice balance` as distinct states.

### Microcopy rules

- Lead with what happened and what to do next.
- Avoid blaming the user.
- Avoid internal technical names, status codes, and provider terminology.
- State time, money, and cancellation consequences explicitly.
- Do not use humor in safety, payment, access, or incident errors.
- Customer-facing policy text links to the authoritative policy version.

## Tenant branding boundaries

### May be tenant-controlled

- Public/customer logo
- Approved primary and secondary colors
- Approved font pairing
- Public imagery
- Public theme preset
- Approved radius/image-style preset

### Remains platform-controlled

- Semantic success, warning, danger, and information colors
- Focus indicators and accessibility behavior
- Form structure and validation
- Booking controls and price presentation structure
- Payment, security, medication, and incident confirmations
- Business Portal core shell and navigation behavior
- Platform Console appearance
- Icon system and component interaction

### Brand validation

- Contrast is calculated for every token pairing used by the selected theme.
- Unsafe colors are adjusted or rejected with guidance.
- Logos require meaningful alternative text or approved decorative treatment.
- Tenant font selections cannot introduce illegible or unavailable fonts.
- Theme preview includes public site, booking, customer portal, validation, and status examples.

## Accessibility foundation

### Required practices

- Semantic HTML before ARIA
- Keyboard access to all functionality
- Visible focus that is not clipped
- Accessible names for controls
- Programmatic labels and descriptions
- Error summary and inline association
- Proper dialog and menu focus management
- Status announcements using appropriate live regions
- Color contrast meeting WCAG 2.2 AA
- Target size and spacing appropriate to context
- Zoom to 200% and reflow to 400% where applicable
- Reduced-motion support
- Captions/transcripts for meaningful prerecorded media when introduced

### Component accessibility gates

A component is not ready for shared use until it passes:

- Keyboard-only workflow review
- Screen-reader name, role, value, and state review
- Contrast review across variants and tenant token examples
- 200% zoom and compact-width review
- Automated accessibility tests
- Manual test for focus order and dynamic announcements

Automated tests support but do not replace manual review.

## Localization readiness

The MVP may launch in one locale, but components must:

- Avoid fixed-width text containers
- Support longer labels and values
- Use locale-aware date, time, number, and currency formatting
- Keep measurement units explicit
- Separate UI strings from component code
- Avoid sentence construction from concatenated fragments
- Support left-to-right initially without blocking future right-to-left evaluation
- Distinguish location time zone from viewer time zone

## Data visualization

Charts follow the Reporting domain's canonical metric definitions.

- Every chart has a title, time basis, accessible summary, and source/freshness context where relevant.
- Use line for time trend, bar for comparison, and stacked bar only for meaningful composition.
- Avoid 3D charts, gauges without thresholds, and decorative pie charts.
- Do not rely on color alone; use labels, shapes, patterns, or direct annotation.
- Start quantitative axes at zero for bar charts unless a clearly explained exception is needed.
- Tables or accessible summaries accompany charts when users need exact values.
- Tooltip content is keyboard accessible or duplicated in another form.
- Cross-currency and mixed-grain data are never combined without explanation.

## Implementation conventions

### CSS variables

Semantic tokens are exposed as CSS custom properties and mapped into Tailwind configuration. Example naming:

```css
:root {
  --surface-canvas: ...;
  --surface-default: ...;
  --text-primary: ...;
  --border-default: ...;
  --action-primary: ...;
  --action-primary-text: ...;
  --focus-ring: ...;
  --danger-surface: ...;
  --danger-foreground: ...;
}
```

Tenant themes provide validated values through a controlled theme object. Components never interpolate untrusted CSS.

### React component practices

- Forward accessible refs where needed.
- Preserve native element semantics.
- Use Radix/shadcn primitives as a starting point, not as an excuse to skip product-specific behavior.
- Use controlled variants through a typed variant utility.
- Keep domain logic outside visual primitives.
- Do not embed permission decisions inside reusable presentational components.
- Support server rendering without hydration-dependent initial meaning.
- Avoid one-off component copies inside feature folders.

### Suggested package boundary

```text
packages/ui/
├── tokens/
├── primitives/
├── composites/
├── patterns/
├── icons/
├── styles/
├── accessibility/
└── testing/
```

Domain assemblies may live with their domain until reuse is proven. A component moves into the shared package only after its general contract is understood.

## Component documentation and testing

Use a component-development environment such as Storybook when application scaffolding begins. Each shared component includes:

- Default and all meaningful variants
- Long, short, empty, loading, disabled, invalid, and error content
- Compact and comfortable density
- Mobile and wide layouts
- Tenant-brand examples where allowed
- Keyboard interaction test
- Automated accessibility test
- Visual regression coverage
- High-contrast and reduced-motion checks where practical

## Design review gates

### Component ready

- Purpose and ownership are clear.
- All states and variants are documented.
- Keyboard and screen-reader behavior is verified.
- Responsive behavior is verified.
- Tokens are used without unexplained raw values.
- Content guidelines and test coverage exist.

### Screen ready

- Requirement and user goal are linked.
- Role, tenant, location, and object context are visible where needed.
- Loading, empty, error, permission, stale, and success states exist.
- Mobile and keyboard flows are designed.
- Sensitive and destructive actions have appropriate controls.
- Analytics and audit needs are identified.
- Copy uses canonical terminology.

### Journey ready

- Entry and exit paths are defined.
- Authentication and interruption recovery are defined.
- Cross-domain revalidation points are clear.
- Failure, retry, cancellation, and timeout behavior are clear.
- Customer/staff notifications and audit events are identified.
- Acceptance scenarios cover the full flow.

## Design system governance

### Ownership

Initially, the solo founder owns product design decisions with AI-assisted implementation and review. The repository remains the durable source of truth.

### Change process

1. Identify the user problem and affected screens.
2. Check for an existing component or pattern.
3. Propose a shared change when the need is general.
4. Review accessibility, responsive, brand, and backward-compatibility impact.
5. Update tokens/components and documentation together.
6. Add migration notes for breaking changes.
7. Verify representative customer, staff, owner, and platform examples.

### Prohibited practices

- Copying a shared component to change one style
- Hard-coding tenant brand colors into domain components
- Creating new status colors without semantic review
- Using only hover for required actions
- Creating inaccessible custom controls when a native control works
- Making a critical action icon-only
- Shipping only the happy state
- Treating disabled controls as authorization
- Using arbitrary z-index, spacing, radius, or shadow values without a documented need

## Foundation requirements

| ID        | Priority | Requirement                                                                                                                       |
| --------- | -------: | --------------------------------------------------------------------------------------------------------------------------------- |
| DS-FR-001 |       P0 | All product surfaces shall use shared semantic tokens and component foundations.                                                  |
| DS-FR-002 |       P0 | Customer-facing surfaces shall support validated tenant branding without changing safety semantics or component behavior.         |
| DS-FR-003 |       P0 | Shared components shall define loading, disabled, read-only, invalid, error, and responsive states where applicable.              |
| DS-FR-004 |       P0 | Protected actions shall display only when contextually useful while remaining server-authorized independently.                    |
| DS-FR-005 |       P0 | The design system shall provide role-appropriate comfortable and compact density variants.                                        |
| DS-FR-006 |       P0 | Components shall use canonical status and urgency semantics rather than domain-specific color inventions.                         |
| DS-FR-007 |       P0 | Public, customer, staff, business, and platform shells shall remain visually related while preserving their context distinctions. |
| DS-FR-008 |       P1 | Shared components shall be documented and testable in an isolated component-development environment.                              |

## Acceptance scenarios

### DS-AC-001: Unsafe tenant color

**Given** a tenant selects a primary color that fails button-text contrast  
**When** the theme is validated  
**Then** publication is blocked or an accessible derived action color is used and the editor sees an explanation.

### DS-AC-002: Status without color

**Given** a user cannot distinguish status colors  
**When** they view confirmed, warning, overdue, and completed records  
**Then** each state remains distinguishable through text and appropriate icon or structure.

### DS-AC-003: Keyboard dialog

**Given** a keyboard user opens a destructive confirmation  
**When** the dialog appears and closes  
**Then** focus moves into it, remains contained, follows a safe action order, and returns to the invoking control.

### DS-AC-004: Mobile medication task

**Given** a staff member records medication on a narrow phone  
**When** the task opens  
**Then** pet identity, drug, dose, route, time, warnings, outcomes, and confirmation remain legible and operable with safe touch targets.

### DS-AC-005: Long localized content

**Given** translated labels are substantially longer than English labels  
**When** they render in navigation and forms  
**Then** content wraps or reflows without clipping required information or controls.

### DS-AC-006: Form submission errors

**Given** a user submits a form with multiple invalid fields  
**When** validation completes  
**Then** focus moves to an error summary, each error links to its field, valid data remains, and errors are announced accessibly.

### DS-AC-007: Loading versus success

**Given** a payment or booking request is still pending  
**When** the interface waits for the authoritative result  
**Then** it prevents duplicate submission and does not display a success state prematurely.

### DS-AC-008: Responsive table

**Given** a customer or operational table cannot fit on a compact screen  
**When** it reflows  
**Then** it becomes a purposeful list or offers controlled scrolling without hiding identity, status, critical alerts, or row actions.

### DS-AC-009: Reduced motion

**Given** the user prefers reduced motion  
**When** dialogs, drawers, alerts, and page transitions occur  
**Then** nonessential animation is removed while state changes remain understandable.

### DS-AC-010: Platform Console distinction

**Given** a platform operator enters a support session for a branded tenant  
**When** tenant data is shown  
**Then** the Platform Console identity and support banner remain dominant and tenant branding cannot make the operator appear to be tenant staff.

## Initial implementation sequence

1. Semantic token files and Tailwind mapping
2. Typography, spacing, sizing, radius, elevation, and status foundations
3. Button, link, icon button, label, input, textarea, checkbox, radio, switch, select
4. Field, validation, alert, toast, tooltip, skeleton, and empty state
5. Dialog, alert dialog, drawer, menu, popover, tabs, breadcrumbs, stepper
6. Card, list, table, badge, avatar/pet photo, timeline
7. Application shells, navigation, tenant/location selector, object header
8. Booking and customer form patterns
9. Operational task, medication, arrival/departure, and incident patterns
10. Calendar, capacity, reporting, and website-authoring components

Components are implemented when required by a vertical slice; the sequence defines dependencies, not authorization to build the entire library upfront.

## Open decisions

- Final platform neutral and action palette
- Primary platform UI font and approved tenant font catalog
- Exact Tailwind breakpoint mapping
- Default border-radius preset
- Business Portal comfortable/compact user preference in MVP
- Storybook versus an equivalent component documentation tool
- Charting library after Reporting prototype needs are known
- Date and time picker library and accessibility review
- Rich text editor for structured website content
- Whether a future staff dark mode is valuable in overnight care environments
- Supported high-contrast behavior beyond system/browser modes

## Related specifications

- [Information Architecture and Navigation](information-architecture.md)
- [Product Vision](../product/product-vision.md)
- [MVP Scope](../product/mvp-scope.md)
- [Identity and Access](../domains/identity-access/README.md)
- [Operations](../domains/operations/README.md)
- [Reporting](../domains/reporting/README.md)
- [Website and Content](../domains/website-content/README.md)
- [Platform Administration](../domains/platform-administration/README.md)
