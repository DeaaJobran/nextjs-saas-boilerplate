# Contributing

Thanks for helping improve the Next.js SaaS Boilerplate. The project is still foundation-stage, but the contribution path is intentionally strict so the starter stays clean as it grows.

## Before You Start

- Read `PROJECT_CHARTER.md`, `ARCHITECTURE.md`, and `FEATURES.md`.
- Check existing issues, discussions, and pull requests.
- Open an issue before large changes, new modules, stack changes, security-sensitive work, or public API changes.
- Do not add proprietary hosted-service lock-in for core runtime features.
- Do not commit files under `/docs`; that directory is ignored for local implementation notes.
- Keep tracked docs accurate when behavior, commands, configuration, or extension points change.

## Development

Install dependencies:

```bash
pnpm install
```

Start local services:

```bash
pnpm services:up
```

Run migrations and seed content:

```bash
pnpm db:migrate
pnpm db:seed
```

Start the web app:

```bash
pnpm dev
```

## Checks

Run focused checks before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm doctor:react
```

Run the full validation gate when the change affects shared runtime behavior, UI workflows, routing, database behavior, auth, tenancy, or release readiness:

```bash
pnpm validate
```

React Doctor should stay at `100/100`. If a regression is unavoidable, document why in the PR and get maintainer approval before merging.

## Commit Style

Use Conventional Commits:

- `feat: add organization invitation model`
- `fix: prevent cross-tenant file access`
- `docs: document auth extension points`
- `chore: update dependency policy`

Use the interactive helper when useful:

```bash
pnpm commit
```

## Pull Request Expectations

Every PR should include:

- Clear description of the change.
- Linked issue when applicable.
- Testing notes.
- Documentation updates for new behavior, commands, configuration, or extension points.
- Screenshots or recordings for UI changes.
- Responsive behavior notes for UI changes.
- RTL/LTR notes when layout, copy, direction, icons, tables, or forms are affected.
- Migration and rollback notes for database changes.
- Security notes for auth, billing, storage, file upload, API keys, webhooks, impersonation, secrets, and tenant isolation changes.

## UI Changes

UI work must:

- Prefer shared `@nextjs-saas/ui` or shadcn-style components over hand-rolled primitives.
- Support mobile, tablet, laptop, desktop, and wide desktop screen sizes.
- Avoid fixed-width assumptions that break localized or RTL content.
- Use localized data and configuration instead of hardcoded product copy where content should be dynamic.
- Include loading, empty, and error states when user-facing.

## Architecture Changes

Add or update an ADR under `adr/` when a change affects:

- Framework or package manager choices.
- Database, auth, tenancy, billing, localization, infrastructure, or deployment strategy.
- Public module boundaries.
- Security model or contributor workflow.
- Release, versioning, or upgrade strategy.
