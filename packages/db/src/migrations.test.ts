import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { upsertManagedPage } from "@nextjs-saas/config/content";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseRuntime, resetDatabaseRuntimeForTests } from "./client";
import {
  readContentSnapshot,
  resetContentDatabase,
  updateContentSnapshot,
} from "./content-repository";
import { migrationManifest } from "./migration-manifest";
import { listMigrationFiles, runMigrations } from "./migrations";

let dataDir: string;
let databaseRuntimeOpened = false;

function getMigrationFilePath(fileName: string) {
  const candidates = [
    path.join(process.cwd(), "migrations", fileName),
    path.join(process.cwd(), "packages", "db", "migrations", fileName),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-db-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  databaseRuntimeOpened = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  if (databaseRuntimeOpened) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

describe("database migrations", () => {
  it("keeps the runtime manifest aligned with SQL migration files", async () => {
    const [migration] = migrationManifest;
    const sql = await readFile(getMigrationFilePath(migration.id), "utf8");

    expect(migration.sql.trim()).toBe(sql.trim());
  });

  it("applies migrations idempotently", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();
    const migrations = await listMigrationFiles();

    await expect(runMigrations(runtime)).resolves.toEqual(migrations);
    await expect(runMigrations(runtime)).resolves.toEqual([]);
  }, 15_000);

  it("seeds content and records versions and audit events for admin changes", async () => {
    databaseRuntimeOpened = true;

    await resetContentDatabase();

    const seededSnapshot = await readContentSnapshot();
    const landingPage = seededSnapshot.pages.find(
      (page) => page.id === "landing-en",
    );

    expect(landingPage?.title).toBe("Next.js SaaS Boilerplate");

    await updateContentSnapshot(
      (currentSnapshot) =>
        upsertManagedPage(currentSnapshot, {
          ...landingPage!,
          title: "Updated from migration test",
          updatedAt: new Date().toISOString(),
        }),
      { actorId: "vitest-admin" },
    );

    const runtime = await getDatabaseRuntime();
    const versionRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM managed_page_versions WHERE page_id = $1",
      ["landing-en"],
    );
    const auditRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM content_audit_events WHERE entity_id = $1 AND actor_id = $2",
      ["landing-en", "vitest-admin"],
    );

    expect(Number(versionRows[0]?.count)).toBeGreaterThan(0);
    expect(Number(auditRows[0]?.count)).toBeGreaterThan(0);
  }, 15_000);
});
