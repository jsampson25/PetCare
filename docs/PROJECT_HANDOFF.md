# Roventra Project Handoff

Last updated: July 25, 2026  
Active development branch: `beta`  
Repository: `jsampson25/PetCare`

## Purpose

This document is the durable handoff for the Roventra project. Read it before continuing work from
another computer, a new Codex thread, or a new development environment. It summarizes the current
product direction, what has been implemented, the deployed environments, known gaps, and the next
recommended milestones.

The repository documentation remains the detailed source of truth. In particular:

- [MVP implementation roadmap](product/mvp-implementation-roadmap.md)
- [MVP scope](product/mvp-scope.md)
- [Customer site builder](ux/customer-site-builder.md)
- [Website and content domain](domains/website-content/README.md)
- [Design system](ux/design-system.md)

## Product Direction

Roventra is an all-in-one SaaS platform for boarding, daycare, grooming, training, and related
pet-care businesses.

The platform has three distinct visual surfaces:

1. **Roventra marketing website**: Promotes the software, plans, capabilities, free trial, security,
   and integrations.
2. **Roventra business workspace**: The management application used by owners and staff. This
   surface uses Roventra platform branding, navy navigation, blue actions, and clean operational
   screens.
3. **Tenant customer experience**: Each pet-care business receives a customizable public website,
   booking flow, account creation flow, and customer portal. These surfaces inherit the tenant's
   selected theme, colors, logo, content, and photography.

The business workspace must not inherit a tenant's public website colors. The tenant name remains
visible as the selected business context, while the management software remains visibly Roventra.

## Current Cloud Environments

| Environment                      | Purpose                             | Address or service             |
| -------------------------------- | ----------------------------------- | ------------------------------ |
| Production marketing/application | Public production deployment        | `https://www.getroventra.com`  |
| Beta application                 | Current testing deployment          | `https://beta.getroventra.com` |
| Source control                   | Code, history, and branches         | GitHub `jsampson25/PetCare`    |
| Application hosting              | Next.js deployment                  | Vercel                         |
| Database and authentication      | PostgreSQL, Auth, Storage, Data API | Supabase                       |
| Transactional email provider     | Branded application email delivery  | Resend                         |

The Vercel beta environment should deploy from the `beta` branch. Production should not receive beta
changes until the tested beta milestone is intentionally promoted.

## Implemented Foundation

### Repository and engineering

- pnpm monorepo using Node.js 24 and pnpm 11
- Next.js 16, React 19, TypeScript, Tailwind CSS, and Zod
- Shared UI and configuration packages
- Supabase migrations, authentication, storage, RLS, and application functions
- GitHub CI, linting, type checking, tests, and production builds
- Vercel deployments for beta and production
- Environment-variable separation between local, preview, and production

### Authentication and account flows

- Owner registration and email confirmation
- Roventra-branded registration and sign-in experiences
- Password confirmation, inline validation, ten-character minimum, and show-password controls
- Loading and submit feedback
- Password reset and email verification callback states
- Optional authenticator setup rather than a forced enrollment
- Terms, privacy, and cookie content available through modal experiences
- Cookie consent choices
- Business selection and tenant-scoped session context

### Business onboarding

- Business and first-location creation
- Guided setup progress that begins with positive completion
- Registered email prepopulation
- Business profile, address, operating hours, closures, capacity, services, pricing, and launch review
- Setup validation and next-step navigation
- Public URL slug validation
- Trial and plan context

### Roventra marketing site

- Modern light-blue visual direction and responsive navigation
- Roventra logo, wordmark, and favicon assets
- Marketing homepage, features, solutions, pricing, integrations, security, and switching content
- Free-trial calls to action
- Competitor-informed capability coverage without copying competitor layouts or wording
- Legal pages and consent surfaces

Marketing pages will need another content and screenshot pass after the business application and
tenant website builder have mature visuals.

### Business workspace

- Roventra platform lockup in the management shell
- Navy grouped sidebar with SVG icons and active states
- Tenant name shown separately as the selected business context
- Roventra blue/navy workspace tokens instead of the previous green generic theme
- Operational command center and grouped navigation
- Calendar, bookings, arrivals, departures, turnover, care work, care logs, service boards,
  playgroups, grooming QA, incidents, report cards, customers, invoices, reports, availability,
  quotes, staff, services, pricing, payments, security, and website settings routes
- Permission-aware navigation and tenant-scoped data access

Many modules have functional foundations but still require richer workflows, polished empty states,
sample data, and deeper visual QA.

### Tenant website and customer branding

- Separate tenant branding from Roventra workspace branding
- Tenant logo, primary color, accent color, and accessible action-color validation
- Public website content, services, contact details, policies, FAQ, SEO content, and custom pages
- Website media library for pet, family, staff, facility, grooming, and brand imagery
- Media placement for hero, services, about, and logo
- Reorderable and hideable website sections
- Tenant theme inheritance through public website, customer authentication, booking, and portal
- Draft, preview, publish, unpublish, version history, rollback, readiness, and custom-domain
  foundations
- Responsive desktop, tablet, and mobile preview studio
- Embedded preview no longer displays the Roventra management shell
- Correct `app` schema calls for draft preview and readiness

### Theme catalog

Three visual families currently exist:

- Modern
- Playful
- Classic

Each family includes three starting templates:

- Modern: Studio Split, Centered Studio, Modern Editorial
- Playful: Happy Tails, Pet Parade, Neighborhood
- Classic: Heritage, Lodge, Professional

Every template now has:

- A visual selection card
- A separate **Preview demo** action
- A separate **Use this theme** action
- A full standalone demo site at `/theme-demo/[template]`
- A tenant-content-safe selection model

The latest theme-preview implementation is commit `e9adcce`.

## Important Recent Commits

| Commit    | Milestone                                                         |
| --------- | ----------------------------------------------------------------- |
| `e9adcce` | Full template demo routes and reliable website draft previews     |
| `3f791c7` | Roventra branding and blue/navy tokens for the business workspace |
| `11e2660` | Visual website template studio                                    |
| `b369e69` | Modern grouped business workspace navigation                      |
| `a13dfda` | Tenant branding preserved through customer authentication         |
| `3d6a09a` | Tenant branding extended across customer flows                    |
| `19e1bc8` | Tenant website logo branding                                      |
| `b655a0f` | Accessible tenant website color enforcement                       |
| `eb339af` | Responsive website preview                                        |
| `7a04743` | Customer site navigation controls                                 |
| `4760045` | Visually differentiated customer website templates                |
| `67223d4` | Multi-section website photography                                 |

## Highest-Priority Next Work

### 1. Make the website builder feel like a real commerce-grade theme editor

The current builder has the right data and publishing foundation, but the editor still needs a more
visual, guided experience:

- [x] Move theme browsing into a dedicated theme-library screen
- [x] Show large desktop and mobile previews before selection
- [x] Add theme details, included sections, style attributes, and recommended business types
- [x] Provide a clear **Try theme** flow that does not overwrite the saved draft until confirmed
- [x] Add a persistent saved-draft canvas beside the editing controls
- [x] Stream unsaved text and brand-color changes into the canvas before saving
- [ ] Stream structural changes such as theme, section order, visibility, and media placement
- [x] Select a section directly from the canvas and focus its matching editor group
- Replace long stacked forms with a focused inspector panel
- Add undo, redo, autosave status, saved state, and unsaved-change protection
- Add true drag-and-drop section ordering on desktop and accessible keyboard reordering
- Add section insertion from an approved block library
- Allow per-section image selection and safe cropping
- Improve page management and navigation editing
- Add responsive device controls without navigating away from the editor
- Add theme duplication and reset-to-template behavior

Do not build unrestricted raw HTML editing for MVP. Keep the builder governed, accessible, secure,
and compatible with tenant branding across booking and the portal.

### 2. Validate the complete website workflow against hosted beta

Test with a real beta owner account:

1. Save a complete website draft.
2. Preview desktop, tablet, and mobile.
3. Open every theme demo.
4. Switch theme families without losing content.
5. Upload and place tenant photos.
6. Add and reorder sections.
7. Add a custom policies page.
8. Publish the website.
9. Open the public tenant URL.
10. Enter booking, registration, and portal flows and confirm the tenant brand remains consistent.
11. Roll back to a prior publication.

Capture defects with screenshots and exact URLs.

### 3. Continue business workspace visual modernization

- Audit every workspace route for leftover green styling and old `PetCare` labels
- Standardize page headers, command bars, filters, tables, cards, forms, and empty states
- Use SVG icons consistently
- Add representative beta sample data so screens can be evaluated visually
- Improve calendar, bookings, customer records, pet records, care boards, invoices, and reports
- Verify desktop, tablet, and mobile layouts
- Maintain WCAG 2.2 AA contrast and keyboard behavior

### 4. Complete tenant customer experience

- Finish customer account and pet onboarding to match the accepted light, modern mockups
- Complete online booking availability and reservation workflow
- Finish vaccination uploads, waivers, deposits, confirmations, messages, invoices, and report cards
- Ensure every customer-facing route uses the same published tenant-theme snapshot

### 5. Production-readiness work

- Configure final branded Supabase authentication templates
- Confirm Resend domain authentication, sender addresses, and delivery monitoring
- Confirm Vercel production and preview environment variables
- Complete backup, audit, privacy, retention, incident-response, and support procedures
- Conduct tenant-isolation and role-permission testing
- Add end-to-end beta tests for signup, onboarding, website publication, booking, and payment
- Review legal documents with qualified counsel before paid launch

## Known Issues and Cautions

- `apps/web/next-env.d.ts` can be modified automatically by Next.js. Do not include that generated
  change in a feature commit unless the framework intentionally requires it.
- Local `.env.local` files are never stored in GitHub. Configure secrets separately on each
  computer and in Vercel.
- Never paste Supabase service-role keys, GitHub tokens, SMTP credentials, or other secrets into a
  Codex conversation.
- The beta branch can deploy automatically. Verify beta before merging or promoting to production.
- Public tenant websites require a valid saved draft and publication before `/site/[slug]` is live.
- The documentation contains both MVP commitments and future enterprise ideas. Follow
  `product/mvp-scope.md` and `product/mvp-implementation-roadmap.md` to avoid uncontrolled scope
  expansion.

## Continue on Another Computer

Install Git, Node.js 24, pnpm 11, VS Code or Codex, and Docker Desktop if local Supabase will be used.
Then:

```powershell
git clone https://github.com/jsampson25/PetCare.git
cd PetCare
git switch beta
pnpm install
```

Create `apps/web/.env.local` using the correct environment values. Do not copy secrets into this
document or commit them.

Before starting work:

```powershell
git pull --ff-only origin beta
git status
pnpm verify
```

Use this prompt in a new Codex thread:

> Continue the Roventra project from the beta branch. Read AGENTS.md and
> docs/PROJECT_HANDOFF.md completely, inspect the latest commits, preserve unrelated work, and
> continue with the highest-priority unfinished milestone.

Before leaving either computer:

```powershell
git status
git push origin beta
```

Only committed and pushed files are reliably available on another computer.

## Completion Definition for the Next Website-Builder Milestone

The next website-builder milestone is complete when:

- Owners browse large, realistic theme previews before applying a theme
- The editor displays the current tenant site in a live responsive canvas
- Owners select, add, edit, reorder, hide, and remove approved sections without navigating through
  one long form
- Autosave and unsaved state are obvious
- Preview works without publishing
- Switching templates preserves business content and media
- Publishing creates one immutable tenant-theme snapshot shared by website, booking,
  authentication, and customer portal
- Tests, linting, type checking, and the optimized production build pass
