# Quality Gates

This project treats quality tooling as part of the product surface. A fresh clone should be able to install dependencies, run local checks, and get the same signal that GitHub Actions uses for pull requests.

## Local Commands

```bash
pnpm install
git diff --check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm playwright:install
pnpm test:e2e
pnpm test:a11y
pnpm doctor:react
```

The combined validation command is:

```bash
pnpm validate
```

`pnpm validate` builds the app, installs Chromium if needed, and runs Playwright against `pnpm start` so browser checks exercise the production build.

To install the browser separately:

```bash
pnpm playwright:install
```

When running Playwright scripts directly, build first:

```bash
pnpm build
pnpm test:e2e
pnpm test:a11y
```

## Commit Policy

Commits use Conventional Commits. Use `pnpm commit` for an interactive prompt, or write messages manually in the same format.

Git hooks run:

- `lint-staged` before commits.
- `commitlint` against commit messages.

## React Doctor Policy

React Doctor is installed for local audits with `pnpm doctor:react`.

The GitHub workflow uses the official `millionco/react-doctor@v2` action. It scans changed files in pull requests and records scores on pushes to `main`. React Doctor should become a required branch protection check after the baseline is stable and the team is comfortable with its signal.

## Deferred Conditional Checks

Some quality checks are intentionally represented as placeholder policy until the underlying artifacts exist:

- Translation validation starts when localization files are introduced.
- Database migration validation starts when Drizzle migrations are introduced.
- OpenAPI validation starts when generated API specs are introduced.

These checks should be added to CI in the same PR that introduces the corresponding artifact type.
