# Next.js SaaS Boilerplate

An open-source, production-minded Next.js SaaS boilerplate for developers who want to launch serious products faster without inheriting hidden architectural debt.

## Status

This repository is in the foundation stage. The current focus is repository governance, architecture decisions, local development quality, and a clean path toward a self-hostable SaaS starter. Do not treat the project as production-ready until the production readiness checklist is complete.

## Principles

- Greenfield architecture with no legacy compatibility layers.
- Open-source first dependencies and self-hostable infrastructure.
- Strong defaults for security, testing, observability, and developer experience.
- Optional advanced modules so downstream projects do not carry unused complexity.
- Clear separation between core starter code and example integrations.

## Planned Stack

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui or equivalent component system
- Radix UI primitives
- Drizzle ORM
- PostgreSQL-first persistence
- Better Auth as the planned self-hosted authentication foundation
- next-intl for localization and RTL/LTR support
- Docker Compose for local and VPS infrastructure
- Caddy for reverse proxy and automatic HTTPS

## Supported Runtime Baseline

- Node.js: `>=22.12 <27`
- pnpm: `>=11.7 <12`
- PostgreSQL target: 17+
- Browsers: latest two stable versions of Chromium, Firefox, and Safari

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm validate
```

Playwright-powered E2E and accessibility checks need Chromium installed:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:a11y
```

React-specific diagnostics:

```bash
pnpm doctor:react
```

## Project Documents

- [Project charter](PROJECT_CHARTER.md)
- [Feature priorities](FEATURES.md)
- [Architecture decisions](adr/)
- [Quality gates](docs-quality.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

Local implementation notes under `/docs` are intentionally ignored by Git. Public documentation lives under `apps/docs`.

## License

MIT
