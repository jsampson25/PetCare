# ADR-0003: Repository and Delivery Architecture

- **Status:** Accepted
- **Date:** 2026-07-17
- **Decision owners:** Product and engineering
- **Roadmap:** E00 Repository and delivery foundation

## Context

PetCare has completed its initial product, domain, UX, security, quality, and roadmap foundation. The next work is to create a deployable application. The repository needs enough structure to preserve module boundaries and testing discipline without imposing enterprise tooling on a solo-founder project.

The platform must support:

- Public tenant websites and booking.
- Customer accounts and portal.
- Staff operations and business administration.
- Platform administration.
- PostgreSQL/Supabase migrations, Auth, Storage, and row-level security.
- Shared accessible design-system components.
- Automated verification and deployment.
- Multiple environments with isolated data and secrets.

The choice must minimize operational burden and AI-generated inconsistency while leaving a credible path to add applications or packages later.

## Decision summary

PetCare will use:

- A **pnpm workspace** as a lightweight TypeScript monorepo.
- **Node.js 24 LTS**, pinned at repository level.
- One deployable **Next.js App Router** application in `apps/web` for all initial web surfaces.
- Domain modules inside the web application with explicit boundaries, not one package per domain initially.
- Shared packages only for stable cross-application concerns.
- The **Supabase CLI local workflow** with versioned SQL migrations and deterministic seed data in a root `supabase/` directory.
- **Vitest** for fast TypeScript tests and **Playwright** for critical browser journeys.
- **GitHub Actions** for required checks and controlled database/application delivery.
- **Vercel** for preview and initial production web deployment.
- Separate Supabase projects and credentials for staging and production.
- A modular monolith with adapters for external providers.
- No Turborepo, Nx, custom build orchestrator, microservices, or containers in the application deployment path until measured need exists.

## 1. Repository structure

The target structure is:

```text
PetCare/
├── .github/
│   ├── workflows/
│   └── pull_request_template.md
├── apps/
│   └── web/
│       ├── public/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── modules/
│       │   ├── platform/
│       │   └── styles/
│       └── package.json
├── packages/
│   ├── config/
│   ├── ui/
│   └── test-support/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── docs/
├── tests/
│   └── e2e/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .nvmrc
├── .node-version
├── .env.example
└── README.md
```

### Existing directories

The current empty `database/` directory will be retired when scaffolding creates `supabase/`. Database documentation remains in `docs/`; executable schema, policies, functions, tests, and seed data live under `supabase/` so the repository follows the supported CLI workflow.

The current root `tests/` directory becomes the location for cross-application/end-to-end suites. Unit, component, and domain integration tests live near the code they verify unless a test is truly cross-cutting.

## 2. Workspace and package manager

### Decision

Use pnpm workspaces with one root lockfile.

### Rules

- Pin the pnpm major/exact approved version through the root `packageManager` field.
- Commit `pnpm-lock.yaml`.
- CI installs with a frozen lockfile.
- Workspace packages use `workspace:` dependencies for internal references.
- One root command delegates lint, type check, test, and build to workspaces.
- Dependency versions are centralized only where doing so reduces drift; do not create elaborate catalogs prematurely.
- Package install scripts are reviewed because they execute code.

### Why pnpm

- Strong workspace support.
- Deterministic lockfile-based installs.
- Efficient disk use.
- Explicit handling of package boundaries.
- Compatible with Next.js, Vercel, GitHub Actions, and the chosen test tools.

### Why not npm workspaces

npm workspaces could support the project, but pnpm provides stronger workspace ergonomics and dependency isolation for a repository expected to gain shared packages. The added setup cost is small.

### Why not Bun

Bun may be reconsidered later, but Node/pnpm offers the lowest compatibility risk across Next.js, Supabase CLI tooling, Vercel, GitHub Actions, and provider SDKs.

## 3. Node.js runtime

### Decision

Use Node.js 24 LTS for local development, CI, builds, and server runtime where configurable.

### Rules

- Pin `24` in `.nvmrc` and `.node-version` initially.
- Declare compatible `engines.node` in the root and application package manifests.
- CI uses the same LTS major through `actions/setup-node` or its current approved successor.
- Minor/patch updates occur through controlled dependency maintenance.
- Do not develop on an end-of-life Node version.
- Revisit the major only after framework/provider compatibility checks and a green full suite.

Node.js currently identifies v24 as LTS, and production applications should use Active or Maintenance LTS releases.

## 4. Application topology

### Decision

Create one Next.js application at `apps/web`.

It serves:

```text
Public website        tenant host / public routes
Booking flow          tenant-scoped booking routes
Customer portal       /portal/*
Staff/business app    /app/*
Platform console      /platform/*
Authentication        /auth/*
```

### Rationale

- One deployment and one framework reduce founder overhead.
- Shared tenant resolution, authentication, design system, and observability remain consistent.
- Public rendering and authenticated workflows can coexist in the App Router.
- Route namespaces preserve product-surface boundaries.
- A second application can be extracted later if security, deployment cadence, performance, or team ownership provides evidence.

### Boundary rules

- Platform Console routes use a distinct shell and authorization path.
- Public tenant resolution happens before tenant data access.
- Customer and staff route groups do not import each other’s page-level code directly.
- Shared components remain free of tenant data-access logic.
- Domain modules expose explicit application services and types rather than arbitrary deep imports.
- Server-only modules are marked and kept out of client bundles.

## 5. Application source organization

The web source uses:

```text
src/
├── app/                       Next.js routes, layouts, loading/error boundaries
├── components/                App-specific compositions
├── modules/                   Business-domain modules
│   ├── business-configuration/
│   ├── identity-access/
│   ├── customer-household/
│   ├── pet-eligibility/
│   ├── service-catalog/
│   ├── resource-capacity/
│   ├── booking-waitlist/
│   ├── pricing-policies/
│   ├── payments-invoicing/
│   ├── operations/
│   ├── communications/
│   ├── reporting/
│   ├── website-content/
│   └── platform-administration/
├── platform/                  Cross-cutting runtime capabilities
│   ├── auth/
│   ├── database/
│   ├── tenancy/
│   ├── observability/
│   ├── feature-flags/
│   ├── jobs/
│   └── integrations/
└── styles/
```

### Module contract

Each domain module may contain:

- `application/` use cases and orchestration.
- `domain/` pure rules, entities/value concepts, and state transitions.
- `data/` repositories and mappings.
- `ui/` domain-specific components and presenters.
- `contracts/` public types/events when needed.
- Tests near their subject.

This is a guide, not permission to create empty folders for every pattern. Add structure when the first implementation needs it.

### Import direction

```text
Routes/UI → Application services → Domain rules
                           ↘ Data/provider adapters
Platform services provide infrastructure through explicit interfaces.
```

- Domain rules do not import React, Next.js, Supabase client libraries, or provider SDKs.
- Provider adapters do not become the source of business state.
- Cross-domain calls use documented application interfaces or events.
- Cyclic domain imports are prohibited.

## 6. Shared packages

### `packages/ui`

Owns stable, accessible, tenant-theme-aware primitives and patterns. It does not query business data or encode domain permissions.

### `packages/config`

Owns shared TypeScript, lint, test, and formatting configuration. It may later include environment-schema helpers that remain runtime-appropriate.

### `packages/test-support`

Owns synthetic builders, test clocks, provider fakes, accessibility helpers, and multi-tenant fixtures that are genuinely shared.

### Package creation rule

Do not create a package merely to make the repository look modular. Extract a package when:

- More than one deployable application needs it; or
- It is a stable, independently testable boundary; and
- Its dependency direction is clear; and
- The package overhead is lower than continued duplication/coupling.

There will not be one npm package per business domain for MVP.

## 7. Next.js conventions

- Use the App Router and TypeScript.
- Prefer Server Components for data-rendering surfaces that do not require client interaction.
- Add Client Components at the smallest interactive boundary.
- Use Server Actions or route handlers only through reviewed application services; framework entry points do not contain business rules.
- Validate every external input at runtime.
- Reauthorize mutations server-side regardless of UI visibility.
- Route loading, error, not-found, and denied states use shared patterns.
- Cache behavior is explicit for tenant/private data; private tenant responses never enter unsafe shared caches.
- Tenant and authentication context are established in trusted server boundaries.
- Do not expose service-role or secret environment variables to `NEXT_PUBLIC_*`.

Next.js supports Node 20.9 or newer at the time of this decision; Node 24 LTS satisfies that minimum.

## 8. Database and Supabase workflow

### Decision

Use the Supabase CLI’s local development workflow and migration files as the executable database source of truth.

### Committed files

- `supabase/config.toml`
- `supabase/migrations/*.sql`
- `supabase/seed.sql` or configured modular seed files
- Database tests and fixtures
- Generated database types only when generation is deterministic and CI-verifiable

### Not committed

- `.env` files containing secrets.
- Supabase `.temp/` and local internal state.
- Local database volumes.
- Production data dumps.
- Generated signed URLs or provider credentials.

### Daily workflow

```text
Start local Supabase
→ reset/apply all migrations
→ seed synthetic tenants
→ run database/RLS tests
→ generate/check TypeScript database types
→ implement and run application tests
```

### Migration rules

- Create forward migrations in version control.
- Review generated diffs; never commit them blindly.
- Test from an empty database and supported previous state.
- Include RLS, grants, indexes, constraints, functions, and triggers in migrations.
- Prohibit direct staging/production Dashboard schema edits except controlled incident remediation followed by reconciliation.
- Apply production migrations through deployment workflow, not a developer laptop.
- Treat destructive or long-running changes as expand/migrate/contract releases.

### Schema strategy

- Use PostgreSQL `public` for application tables initially unless a reviewed security/organization reason supports another schema.
- Keep provider-managed Auth/Storage schemas provider-owned.
- Every tenant table includes `business_id` and approved RLS.
- Runtime roles do not own tables or bypass RLS.
- Database types are generated from the local migration result and compared in CI.

## 9. Environment model

| Environment | Application | Supabase/data | Purpose |
|---|---|---|---|
| Local | Developer machine | Local Supabase stack | Fast coding, migrations, tests |
| CI ephemeral | GitHub runner/test process | Disposable PostgreSQL/Supabase-compatible stack | Automated verification |
| Preview | Vercel branch deployment | Approved isolated nonproduction backend | Product/design review; no production data |
| Staging | Stable Vercel environment | Dedicated staging Supabase project | Release rehearsal and provider sandboxes |
| Production | Vercel production | Dedicated production Supabase project | Real tenant operation |

### Environment rules

- Production and nonproduction never share database, storage, Auth project, provider secret, webhook endpoint, or encryption context.
- Preview deployments do not receive production secrets.
- A shared preview backend may be used initially only with synthetic data and namespaced cleanup; security-sensitive database changes use disposable or dedicated test environments.
- Staging configuration should resemble production while using sandbox/provider test modes.
- Environment names are explicit in logs, jobs, events, and administrative interfaces.

## 10. Environment configuration

- Define a typed runtime environment schema.
- Fail startup/build clearly when required variables are missing or malformed.
- Maintain `.env.example` with names and non-secret descriptions.
- Separate server-only from intentionally public variables.
- Never log secret values.
- Vercel and GitHub environment secrets are the delivery stores; local secrets remain ignored files or approved local secret tooling.
- Rotate secrets without requiring code changes where providers permit.
- Include tenant-independent provider account identifiers only when safe; tenant secrets remain encrypted application data.

## 11. Testing architecture

### Fast checks

- TypeScript compiler for type checking.
- ESLint/current approved lint configuration.
- Vitest for unit, property, component, and focused integration tests.
- DOM/user-event testing through accessible roles and names.

### Database checks

- Real PostgreSQL/Supabase local instance for migrations, constraints, functions, triggers, and RLS.
- At least two synthetic tenants with similar data.
- SQL tests or TypeScript integration tests according to the behavior under test.

### Browser checks

- Playwright in root `tests/e2e`.
- Chromium on pull requests for critical smoke paths initially.
- Broader Chromium/Firefox/WebKit matrix on main/scheduled runs as suites grow.
- axe-core integration plus required manual accessibility evaluation.

### Provider checks

- Local deterministic fakes for common paths.
- Contract fixtures and signature tests.
- Sandbox tests for Stripe, email, SMS, and storage at controlled cadence.

The [Platform Test Strategy](../quality/test-strategy.md) remains authoritative for evidence and release gates.

## 12. Root command contract

The scaffold must expose stable commands similar to:

```text
pnpm dev              Start web development
pnpm build            Build all deployable applications
pnpm lint             Run lint checks
pnpm typecheck        Run TypeScript checks
pnpm test             Run fast automated tests
pnpm test:e2e         Run Playwright journeys
pnpm test:db          Reset/test database and RLS
pnpm check            Run required local pre-push checks
pnpm db:start         Start local Supabase
pnpm db:reset         Rebuild local database from migrations and seeds
pnpm db:types         Generate database TypeScript types
```

Exact scripts are established during scaffolding. CI and documentation call the stable root commands instead of duplicating internal tool commands.

## 13. Git and branch model

- `main` is the protected, releasable integration branch once GitHub configuration is available.
- Normal implementation uses short-lived branches and pull requests.
- Direct main commits may be used during the current solo documentation bootstrap, but application code should move to reviewed PRs.
- Require passing checks before merge.
- Prefer squash merge for focused implementation changes unless preserving a meaningful multi-commit history is valuable.
- Release/deployment identity uses the immutable Git commit SHA.
- Do not maintain long-lived environment branches.

## 14. GitHub Actions design

### Pull request workflow

1. Checkout with least necessary token permission.
2. Install pinned Node and pnpm.
3. Install from frozen lockfile.
4. Run formatting/lint/type/secret/dependency checks.
5. Run unit/component tests.
6. Apply/reset migrations and run database/RLS tests for affected stages.
7. Build the web app.
8. Run critical browser smoke tests against a controlled environment.
9. Upload safe test artifacts on failure.

### Main workflow

- Re-run required checks from a clean environment.
- Produce identifiable build/deployment artifact.
- Apply staged deployment policy.
- Run migration step with environment protection.
- Deploy application.
- Run safe smoke tests and verify monitoring.

### Workflow security

- Default token permissions are read-only; grant job-specific write permissions.
- Pin third-party actions to reviewed commit SHAs where practical.
- Untrusted pull requests do not receive deployment/provider secrets.
- Caches contain dependencies/build inputs only, never secrets or customer data.
- Deployment environments can require approval for production.
- Artifacts are retained according to value and sensitivity.
- Prevent overlapping production deployments with concurrency controls.

GitHub documentation warns that caches should be treated as untrusted input and never hold sensitive information.

## 15. Deployment sequence

### Application-only change

```text
Validate → build → preview/staging → smoke → production deploy → production verify
```

### Compatible database change

```text
Validate migration from prior state
→ apply additive migration
→ deploy compatible application
→ verify
```

### Breaking data change

```text
Expand schema
→ deploy dual-compatible code
→ backfill idempotently
→ verify reads/writes
→ switch behavior behind flag
→ contract old schema in later release
```

Application rollback must not encounter a database schema it cannot understand. Database rollback is not assumed safe merely because a down script exists.

## 16. Vercel deployment

- Connect `apps/web` as the application root or configure workspace-aware build commands.
- Use preview deployments for pull requests.
- Use a stable staging project/environment when release rehearsal differs from previews.
- Production deployment maps to the approved main commit.
- Public custom domains are attached only through the verified tenant-domain workflow; the platform application’s own domain configuration is infrastructure-controlled.
- Server and edge runtimes are selected per route based on library/database compatibility, not novelty.
- Long-running work does not depend on a request remaining open; use durable background processing when introduced.

Next.js remains portable to Node server or container deployment if future constraints make Vercel unsuitable.

## 17. Background work

E00 defines an interface but does not introduce Redis/BullMQ.

Initial background needs may use:

- Provider-native webhook delivery into persisted inbox/outbox tables.
- Scheduled functions/cron appropriate to the hosting/database platform.
- Database-backed jobs with idempotent claiming if required.

A dedicated queue is introduced only when retry volume, scheduling, throughput, or reliability evidence requires it. Every job must carry trusted tenant, actor/system, purpose, correlation, and idempotency context.

## 18. Observability foundation

The scaffold includes:

- Structured server logs.
- Correlation ID per request and propagated job/event IDs.
- Environment, route, release SHA, tenant ID (controlled), and safe actor classification.
- Error reporting adapter with sensitive-data scrubbing.
- Health/readiness indicators for critical dependencies.
- Initial product/business event interface.
- No raw request bodies, credentials, signed URLs, medical notes, payment data, or message content in general logs.

Vendor selection for hosted error/telemetry tooling may occur during E00 implementation without changing the architecture if it satisfies this contract.

## 19. Feature controls

Use a small internal interface from the start:

- Stable feature key.
- Environment default.
- Optional tenant allowlist/override where needed.
- Server-authoritative evaluation.
- Audit for platform changes.
- Kill-switch behavior for risky integrations/workflows.

Do not purchase or build a complex experimentation platform for MVP. The interface permits replacement later.

## 20. External provider adapters

Stripe, Resend, Twilio, OpenAI, storage, maps, and future providers are accessed through platform adapters.

Rules:

- Provider payloads are translated at the boundary.
- Provider IDs are stored alongside internal state, not used as domain primary keys.
- Signatures and tenant/account mapping are verified before processing.
- Business state remains in PostgreSQL.
- Adapters support deterministic fakes and contract fixtures.
- Core booking/operations do not depend on AI availability.

## 21. Dependency and supply-chain policy

- Add dependencies only for a clear maintained capability.
- Prefer framework/platform primitives before small one-purpose packages.
- Review license, maintenance, release activity, transitive size, install scripts, and server/client compatibility.
- Pin lockfile and automate vulnerability review.
- Do not auto-merge major upgrades.
- Upgrade framework/runtime versions in focused changes with full validation.
- Remove unused packages promptly.
- Keep third-party code out of sensitive execution paths when simpler owned code is safer.

## 22. Architecture enforcement

Initially enforce through:

- TypeScript path aliases with public module entry points.
- ESLint import-boundary rules where they produce clear value.
- Server-only markers and build checks.
- Code review checklist.
- Architecture tests for prohibited imports as modules emerge.

Do not add a build orchestrator solely for dependency graphs. Reconsider Turborepo/Nx when CI time, multiple applications, caching, or boundary enforcement becomes a measured problem.

## 23. Security requirements

- Follow the [Multi-Tenant Security Model](../architecture/multi-tenant-security.md).
- RLS and server authorization exist from the first tenant table.
- Service role and database credentials remain server-only.
- Preview/untrusted builds receive no production secrets.
- Tenant host resolution is allowlisted and validated.
- CSRF, origin, cookie, session, upload, webhook, and redirect behavior receive explicit implementation design.
- Generated source maps and error artifacts do not expose secrets or private data.
- Dependency caching and CI artifacts are treated as untrusted/non-secret.
- Administrative paths use distinct authorization and audit.

## 24. Accessibility and responsive requirements

- Shared UI implements the [Responsive and Accessibility Interaction Standards](../ux/responsive-accessibility-standards.md).
- App Router focus and route announcements are tested.
- Server/client rendering does not reorder meaningful content.
- Critical routes work with keyboard, screen reader, zoom, reflow, forced colors, reduced motion, and touch.
- Automated axe checks are integrated early; human testing remains required.
- Tenant branding cannot weaken contrast or state meaning.

## 25. Performance posture

- Prefer server rendering and progressive delivery for public/customer content where useful.
- Avoid shipping server/provider libraries to the browser.
- Measure bundle and route performance before adding budgets.
- Add database indexes based on defined query paths and verify RLS policy performance.
- Avoid application-level N+1 queries.
- Use explicit cache policy; never cache private tenant data casually.
- Image/media optimization preserves access control.

E00 establishes measurement hooks; numeric service objectives are calibrated with the first vertical slices.

## 26. Local development prerequisites

The target developer machine needs:

- Git.
- Node.js 24 LTS.
- pnpm at the pinned version.
- Docker-compatible runtime required by local Supabase.
- Supabase CLI through a pinned project dependency or approved installation.

Windows is supported. Scripts should be cross-platform Node/package scripts rather than shell-specific where practical.

## 27. Scaffolding acceptance criteria

### ADR3-AC-001: Reproducible install

**Given** a clean supported machine with prerequisites  
**When** the documented install and verification commands run  
**Then** dependencies install from the lockfile and checks/build complete without undocumented global packages.

### ADR3-AC-002: Local database reset

**Given** the local Supabase stack  
**When** the database reset command runs  
**Then** all migrations apply in order, synthetic seed data loads, generated types match, and database tests pass.

### ADR3-AC-003: CI parity

**Given** a pull request  
**When** GitHub Actions runs  
**Then** it invokes the same root quality commands available locally and fails on lockfile, type, test, migration, build, or secret violations.

### ADR3-AC-004: Environment isolation

**Given** a preview deployment  
**When** it runs  
**Then** it cannot access production Supabase, storage, Stripe, communications, or secrets.

### ADR3-AC-005: Tenant foundation

**Given** two synthetic tenants  
**When** initial database/RLS tests run  
**Then** each tenant sees only its records and requests without trusted context fail closed.

### ADR3-AC-006: Accessible shell

**Given** each product shell  
**When** tested at compact width, keyboard-only, and automated accessibility scan  
**Then** navigation, focus, landmarks, status, and error behavior meet the foundation standards.

### ADR3-AC-007: Build identity

**Given** a deployed build  
**When** support inspects its safe diagnostics  
**Then** environment and Git commit identity are available without revealing secrets.

### ADR3-AC-008: Provider boundary

**Given** an unavailable optional provider adapter  
**When** the application starts or invokes unrelated core behavior  
**Then** unrelated core behavior remains available and the dependency failure is observable.

## 28. Consequences

### Positive

- One deployable app keeps operations manageable.
- Workspace structure supports stable shared code without mandatory package proliferation.
- Migrations and seeds make database state reproducible.
- Next.js serves public and authenticated experiences consistently.
- Tenant isolation and tests begin before feature data grows.
- Vercel/Supabase reduce infrastructure burden.
- The architecture remains portable if future needs change hosting.

### Costs and tradeoffs

- One application has a larger blast radius than separately deployed surfaces.
- Domain boundaries rely on discipline and lightweight enforcement within one codebase.
- Local Supabase requires Docker resources and differs from hosted features in some areas.
- Preview backend isolation needs deliberate configuration.
- pnpm adds one tool beyond Node/npm.
- Database and application deployments require compatibility planning.

### Risks

- Shared application imports may erode modular boundaries.
- Server/client boundaries may leak code or secrets if misused.
- Direct Dashboard schema changes may create drift.
- A shared preview backend may produce test interference.
- Service-role use may bypass RLS.

Each risk has explicit rules and tests in this decision and related specifications.

## 29. Alternatives considered

### Separate Next.js apps for public, customer, staff, and platform

Rejected for MVP because it multiplies deployments, authentication integration, shared design work, and environment management before scale or team ownership requires it.

### Turborepo or Nx immediately

Deferred. Both can add valuable task graphs and caching, but the initial workspace has one application and few packages. Add only when CI or multi-app complexity justifies it.

### Separate NestJS backend

Rejected for MVP. It would add deployment, contracts, authentication propagation, and operational overhead. Application services remain framework-separated enough for later extraction.

### Microservices

Rejected. Domain boundaries do not require independent deployment, and distributed transactions would make booking, pricing, capacity, and payments harder for a solo founder.

### Prisma as the primary database abstraction

Not selected initially. PetCare depends heavily on PostgreSQL constraints, RLS, policies, functions, and migrations. Supabase-generated types and focused repositories avoid treating the database as a lowest-common-denominator store. An additional query builder/ORM may be evaluated for application ergonomics after the first schema slice.

### Cloud database only with Dashboard-managed schema

Rejected. It is not reproducible enough for safe multi-tenant migrations and AI-assisted development.

### Docker/Kubernetes application deployment

Rejected for MVP. Vercel plus managed Supabase supplies adequate initial deployment with lower operational load. Next.js portability preserves an exit path.

### Native mobile application now

Rejected by MVP scope. Responsive web serves customer and staff workflows first.

## 30. Revisit triggers

Reconsider this decision when one or more occur:

- A second deployable application is approved.
- CI time/cost becomes material and task caching has measured benefit.
- Platform Console requires stronger deployment isolation.
- Vercel runtime limits block core reliable workloads.
- A dedicated queue or service is needed for measured background volume.
- A domain requires independent scaling, compliance boundary, or team ownership.
- Supabase no longer satisfies security, regional, scale, or operational requirements.
- Multiple teams require stronger package ownership and build orchestration.

Any change requires a new ADR; do not rewrite this accepted historical decision.

## 31. Implementation sequence

1. Add root Node/pnpm/workspace configuration.
2. Scaffold `apps/web` with Next.js App Router, TypeScript, Tailwind, and linting.
3. Add shared config, UI, and test-support packages.
4. Initialize Supabase local configuration, empty baseline migration, seed, and database test command.
5. Add Vitest and Playwright foundations.
6. Add root command contract and environment validation.
7. Add GitHub Actions pull-request workflow.
8. Add preview/staging deployment configuration.
9. Add structured logging, correlation, health, feature interface, and safe error shell.
10. Verify all scaffolding acceptance criteria.

## 32. Related specifications

- [ADR-0001: Modular monolith](ADR-0001-modular-monolith.md)
- [ADR-0002: Business-scoped multi-tenancy](ADR-0002-business-multi-tenancy.md)
- [Architecture overview](../architecture/overview.md)
- [Technology stack](../architecture/technology-stack.md)
- [Multi-tenant security model](../architecture/multi-tenant-security.md)
- [MVP implementation roadmap](../product/mvp-implementation-roadmap.md)
- [Platform test strategy](../quality/test-strategy.md)
- [Design system foundation](../ux/design-system.md)

## 33. Authoritative references checked

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Next.js installation and system requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js deployment options](https://nextjs.org/docs/app/getting-started/deploying)
- [Supabase local development with migrations](https://supabase.com/docs/guides/local-development/overview)
- [Supabase CLI local workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [GitHub Actions: building and testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [GitHub Actions dependency-cache security](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching)

