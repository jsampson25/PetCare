# Technology Stack

This is the proposed initial stack, not an irreversible commitment.

| Concern | Initial choice | Rationale |
|---|---|---|
| Web application | Next.js + React + TypeScript | One framework for public pages, portals, server rendering, and application endpoints. |
| UI | Tailwind CSS + shadcn/ui | Fast, accessible component development with full control of the design system. |
| Validation | Zod | Shared runtime validation and TypeScript inference. |
| Forms | React Hook Form | Performant form state and strong integration with schema validation. |
| Transactional data | Supabase PostgreSQL | Managed relational database with strong SQL capabilities and row-level security. |
| Authentication | Supabase Auth | Integrated identity foundation suitable for the initial product. |
| File storage | Supabase Storage | Tenant-scoped vaccine documents, agreements, pet photos, and report-card media. |
| Payments | Stripe; Stripe Connect when tenant merchant onboarding is required | Strong payment, refund, webhook, and connected-account support. |
| Email | Resend | Straightforward transactional email API. |
| SMS | Twilio | Mature programmable messaging with delivery events. |
| Hosting | Vercel initially | Low-operations Next.js deployment and preview environments. |
| Source control and CI | GitHub + GitHub Actions | Versioning, reviews, automated checks, and deployment integration. |
| Product AI | OpenAI APIs behind an internal gateway | Centralized privacy, model, prompt, safety, and spend controls. |

## Deliberately excluded from the initial architecture

- Microservices
- Kubernetes
- A separate NestJS backend
- Redis and complex queue infrastructure unless a demonstrated need appears
- Native mobile applications
- A dedicated data warehouse

These may be introduced through architecture decisions when product scale or reliability requirements justify the additional operating cost.

