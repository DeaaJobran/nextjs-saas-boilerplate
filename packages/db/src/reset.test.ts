import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseRuntime, resetDatabaseRuntimeForTests } from "./client";
import { runMigrations } from "./migrations";
import { resetDatabaseData } from "./reset";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-reset-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  const runtime = await getDatabaseRuntime();

  await runtime.close();
  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

describe("database reset", () => {
  it("clears messaging records before restoring managed seed content", async () => {
    const runtime = await getDatabaseRuntime();
    const timestamp = "2026-08-03T12:00:00.000Z";

    await runMigrations(runtime);
    await runtime.execute(
      `
        INSERT INTO auth_users (
          id, email, normalized_email, display_name, created_at, updated_at
        )
        VALUES ('reset-user', 'reset@example.test', 'reset@example.test', 'Reset User', $1, $1)
      `,
      [timestamp],
    );
    await runtime.execute(
      `
        INSERT INTO organizations (id, slug, name, created_at, updated_at)
        VALUES ('reset-tenant', 'reset-tenant', 'Reset Tenant', $1, $1)
      `,
      [timestamp],
    );
    await runtime.execute(
      `
        INSERT INTO message_deliveries (
          id, tenant_id, user_id, channel, event_type, template_key,
          locale, recipient, provider, status, queued_at, created_at, updated_at
        )
        VALUES (
          'reset-delivery', 'reset-tenant', 'reset-user', 'email',
          'test.reset', 'test', 'en', 'reset@example.test', 'preview',
          'queued', $1, $1, $1
        )
      `,
      [timestamp],
    );
    await runtime.execute(
      `
        INSERT INTO messaging_audit_events (
          id, tenant_id, user_id, delivery_id, event_type, payload, created_at
        )
        VALUES (
          'reset-message-audit', 'reset-tenant', 'reset-user',
          'reset-delivery', 'messaging.delivery.queued', '{}'::jsonb, $1
        )
      `,
      [timestamp],
    );

    await resetDatabaseData();

    for (const table of [
      "auth_users",
      "organizations",
      "message_deliveries",
      "messaging_audit_events",
    ]) {
      const [row] = await runtime.execute<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${table}`,
      );
      expect(Number(row?.count)).toBe(0);
    }

    const [seededContent] = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM managed_pages WHERE id = 'landing-en'",
    );
    expect(Number(seededContent?.count)).toBe(1);
  }, 60_000);
});
