# Architecture

## Workspace Shape

The repository is a pnpm workspace:

- `apps/web`: primary Next.js App Router application.
- `apps/docs`: public documentation application.
- `packages/config`: product configuration, environment validation, metadata helpers, and managed content contracts.
- `packages/localization`: supported locales, text direction, and locale-aware formatting helpers.
- `packages/ui`: shared shadcn-style UI primitives, state components, data display components, and design tokens.

Marketing routes live inside `apps/web` until there is a real operational reason to split them into a separate app. Future modules should only become packages when they have real code, tests, ownership, and documentation.

## React Baseline

The supported React baseline is React `19.2.x`, paired with Next.js `16.2.x`.

React upgrades must:

- Keep `pnpm doctor:react` passing.
- Keep Storybook building.
- Keep Playwright E2E and accessibility checks passing.
- Include migration notes when behavior, rendering, or supported APIs change.

## Module Boundaries

Current packages are intentionally limited to application foundation code. The following boundaries are reserved for future implementation when their features are ready to ship end-to-end:

- `core`
- `tenant`
- `auth`
- `payments`
- `billing`
- `currency`
- `tax`
- `files`
- `storage`
- `api`
- `webhooks`
- `mobile`
- `jobs`
- `security`
- `observability`
- `testing`

Do not add empty packages for these boundaries. Introduce each one with real behavior, tests, docs, and integration points.
