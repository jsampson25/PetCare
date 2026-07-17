# PetCare Platform

PetCare Platform is a modern, all-in-one SaaS platform for businesses that provide dog boarding, daycare, and grooming.

The product is designed around the pet and the daily work of the business—not around disconnected booking modules. It will combine customer self-service, pet records, booking, waitlists, deposits, payments, staff operations, communications, websites, and business reporting in one consistent experience.

## Initial product scope

- Boarding, daycare, and grooming services
- Business and location setup
- Customer accounts and households
- Pet profiles, vaccination records, care instructions, and documents
- Configurable availability, capacity, pricing, deposits, and waitlists
- Customer booking and account portal
- Staff check-in, care, and check-out workflows
- Payments, invoices, refunds, and balances
- Email and SMS notifications
- Operational and financial reporting
- Business website and online booking experience

Pet sitting and dog walking are planned extensions, not MVP requirements.

## Product principles

1. **One seamless product** — public websites, booking, customer accounts, and staff tools share a consistent design system.
2. **Configuration over hard-coding** — businesses control services, pricing, capacity, vaccine rules, deposits, and policies.
3. **Safety before convenience** — pet care alerts, medication controls, eligibility rules, and audit history are first-class features.
4. **Daily workflows first** — the product surfaces what staff need to do now instead of making them hunt through modules.
5. **AI is optional assistance** — core booking and operations must remain reliable without AI services.

## Proposed technology foundation

- Next.js, React, and TypeScript
- Tailwind CSS and shadcn/ui
- PostgreSQL through Supabase
- Supabase Auth and Storage
- Stripe and Stripe Connect
- Resend for email and Twilio for SMS
- Vercel for initial web hosting
- GitHub Actions for automated checks and deployments

Technology choices are recorded in [docs/architecture/technology-stack.md](docs/architecture/technology-stack.md) and may change through documented decisions.

## Repository map

```text
apps/                    Deployable applications
packages/                Reusable UI, configuration, and shared code
supabase/                Database configuration, migrations, policies, tests, and seed data
docs/                    Product and engineering source of truth
tests/                   Cross-application and end-to-end tests
.github/                 GitHub templates and automation
```

Start with the [documentation index](docs/README.md), [product vision](docs/product/product-vision.md), and [architecture overview](docs/architecture/overview.md).

## Current status

Initial application scaffold. The workspace, web shell, shared packages, database tooling, automated checks, and CI foundation are in place; business capabilities are implemented through the MVP roadmap.

## Local setup

Prerequisites: Node.js 24, pnpm 11, Git, Docker Desktop, and the Supabase CLI.

```powershell
Copy-Item .env.example .env.local
pnpm install
supabase start
pnpm dev
```

The web application runs at `http://localhost:3000` and its health endpoint is available at `http://localhost:3000/api/health`.
