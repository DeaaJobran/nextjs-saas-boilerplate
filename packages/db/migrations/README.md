# Database Migrations

Runtime migrations are tracked as ordered SQL files in this directory and embedded in `packages/db/src/migration-manifest.ts` so scripts, tests, and packaged runtime code apply the same migration list.

`pnpm db:generate` writes Drizzle draft migrations to `packages/db/migrations/generated/`. Treat those files as local review artifacts: inspect the generated SQL, promote the reviewed statements into the next numbered runtime migration, and add the same SQL to the migration manifest before committing.
