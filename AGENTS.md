# PetCare Codex Guidance

These instructions apply to the entire repository.

## Product and architecture

- Treat `docs/` as the product and engineering source of truth.
- Follow the accepted architecture decisions in `docs/decisions/`.
- Implement work in the order defined by `docs/product/mvp-implementation-roadmap.md` unless the user changes the priority.
- Preserve the modular-monolith and business-scoped multi-tenant boundaries.
- Use the terminology defined in `docs/product/glossary.md`.

## Engineering workflow

- Use Node.js 24 and pnpm 11.
- Keep deployable web behavior in `apps/web`, reusable interface components in `packages/ui`, shared configuration in `packages/config`, test helpers in `packages/test-support`, and database history in `supabase/`.
- Prefer the smallest implementation that completely satisfies the current milestone.
- Do not add a new application, service, package, framework, or infrastructure dependency without a documented need.
- Use versioned Supabase migrations for every database change. Never edit production data or schema manually.
- Keep secrets out of source control. Update `.env.example` when configuration requirements change.
- Preserve unrelated user changes and never use destructive Git commands to discard work.

## Quality requirements

- Add or update tests in proportion to the risk of each change.
- Handle loading, empty, error, and permission-denied states where relevant.
- Verify tenant isolation, role permissions, audit requirements, accessibility, and responsive behavior for affected features.
- Run the smallest relevant checks while developing and `pnpm verify` before declaring an application milestone complete.
- If full verification cannot run, clearly state what was validated and what remains unverified.
- Keep documentation synchronized with behavior, APIs, schemas, terminology, and architectural decisions.

## Git delivery

- After a requested milestone is complete and its available verification passes, create one focused Git commit with a concise conventional-style message.
- Do not commit partial, failing, unrelated, generated-secret, or temporary diagnostic files.
- Push commits to GitHub only when the user explicitly requests a push or says `commit and push`.
- Before pushing, confirm the intended branch, the committed scope, and the available verification result.
- Never force-push unless the user explicitly requests it and the consequences have been explained.

## Communication

- Lead with the completed outcome and any material limitation.
- Keep instructions understandable to a solo founder who may not be familiar with development tooling.
- Explain decisions that materially change product scope, security, recurring cost, or operational complexity.
