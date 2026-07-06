# Quality Gates

This project treats quality tooling as part of the product surface. A fresh clone should be able to install dependencies, run local checks, and get the same signal that GitHub Actions uses for pull requests.

## Local Commands

Install dependencies first:

```bash
pnpm install
```

Common checks:

```bash
git diff --check
pnpm format:check
pnpm lint
pnpm i18n:check
pnpm typecheck
pnpm test
pnpm build
pnpm build:storybook
pnpm doctor:react
```

The combined validation command is:

```bash
pnpm validate
```

`pnpm validate` runs whitespace checks, formatting, linting, translation validation, type checking, tests, production build, Storybook build, Chromium installation, E2E tests, and accessibility tests.

## Browser Checks

To install Chromium separately:

```bash
pnpm playwright:install
```

When running Playwright scripts directly, build first:

```bash
pnpm build
pnpm test:e2e
pnpm test:a11y
```

## Storybook

Run Storybook locally:

```bash
pnpm storybook
```

Build Storybook for CI parity:

```bash
pnpm build:storybook
```

## Commit Policy

Commits use Conventional Commits. Use `pnpm commit` for an interactive prompt, or write messages manually in the same format.

Git hooks run:

- `lint-staged` before commits.
- `commitlint` against commit messages.

## React Doctor Policy

React Doctor is installed for local audits with:

```bash
pnpm doctor:react
```

The GitHub workflow uses the official `millionco/react-doctor@v2` action. The current baseline is `100/100` with `0` errors and `0` warnings. PRs should keep that score at 100 unless maintainers explicitly accept and document a temporary regression.

## Documentation Policy

Documentation updates are required when a change affects:

- Public setup or runtime commands.
- Environment variables.
- Package/module boundaries.
- User-facing behavior or admin workflows.
- Database migrations, seeds, rollback, or reset behavior.
- Security, auth, sessions, tenant isolation, API keys, webhooks, file upload, impersonation, or secrets.
- Release tags, versioning, or upgrade expectations.

Local implementation notes under `/docs` stay untracked. Public docs should be kept in tracked root Markdown files, ADRs, package docs, and `apps/docs`.

## Deferred Conditional Checks

Some quality checks are intentionally represented as policy until the underlying artifacts exist:

- OpenAPI validation starts when generated API specs are introduced.
- Snapshot visual regression validation starts when visual snapshot tooling is introduced. Current RTL layout regression checks run through Playwright E2E overflow assertions.

These checks should be added to CI in the same PR that introduces the corresponding artifact type.
