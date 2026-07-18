# PetCare UI

Shared interface primitives for every PetCare surface. Components use the semantic tokens defined by the web application and must remain usable with keyboard, touch, zoom, reduced motion, and assistive technology.

## Available foundations

| Export               | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `alert`              | Informational, success, warning, and danger messages with textual meaning |
| `app-shell`          | Responsive customer, business, and platform navigation shells             |
| `badge`              | Compact textual status labels                                             |
| `button`             | Primary, secondary, quiet, destructive, disabled, and loading actions     |
| `button-link`        | Navigation styled as an action                                            |
| `card`               | Grouped content surface with optional title and description               |
| `data-table`         | Semantic tabular data with caption and contained overflow                 |
| `dialog`             | Managed native modal with focus containment and Escape behavior           |
| `field`              | Visible-label text input with linked guidance and error output            |
| `form-error-summary` | Focusable error index linking to invalid fields                           |
| `navigation`         | Permission-aware presentation filtering; never an authorization boundary  |
| `state-panel`        | Empty, unavailable, denied, or informational page state                   |
| `tabs`               | Arrow-key-operable tab list and associated panels                         |
| `upload-field`       | Labeled file selection with type and size validation helpers              |

The live review route is `/app/design-system`. Add new primitives only when a real feature needs a reusable interaction contract. Prefer native HTML semantics; introduce a headless component dependency when focus management, keyboard behavior, or interaction complexity makes a native implementation insufficient.

## Component requirements

- Interactive targets are at least 44px in general use.
- Focus remains visible and is never communicated by color alone.
- Labels and status text remain present for screen readers and at high zoom.
- Loading prevents duplicate submission and states that work is ongoing.
- Danger actions use explicit language and require confirmation at the feature layer when destructive.
- Tenant branding may alter approved action tokens only after contrast validation.
