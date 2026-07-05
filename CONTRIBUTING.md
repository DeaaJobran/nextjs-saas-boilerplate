# Contributing

Thanks for helping improve the Next.js SaaS Boilerplate. This project is early-stage, but we keep the contribution path strict from the beginning so the foundation stays clean.

## Before You Start

- Read `PROJECT_CHARTER.md`.
- Check existing issues and discussions.
- Open an issue before large changes, new modules, stack changes, or security-sensitive work.
- Do not add proprietary hosted-service lock-in for core runtime features.
- Do not commit files under `/docs`; that directory is ignored for local planning notes.

## Development

```bash
pnpm install
pnpm dev
```

Run checks before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

or:

```bash
pnpm ci
```

## Commit Style

Use Conventional Commits:

- `feat: add organization invitation model`
- `fix: prevent cross-tenant file access`
- `docs: document auth extension points`
- `chore: update dependency policy`

## Pull Request Expectations

Every PR should include:

- Clear description of the change.
- Linked issue when applicable.
- Testing notes.
- Screenshots for UI changes.
- Migration notes for database changes.
- Security notes for auth, billing, storage, file upload, API keys, webhooks, or impersonation changes.
- Documentation updates for new extension points.

## Architecture Changes

Add or update an ADR under `adr/` when a change affects:

- Framework or package manager choices.
- Database, auth, tenancy, billing, localization, infrastructure, or deployment strategy.
- Public module boundaries.
- Security model or contributor workflow.

