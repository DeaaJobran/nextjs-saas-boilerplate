import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSecurityService, fingerprintLegalDocument } from "./service";

const fixedNow = new Date("2026-08-01T12:00:00.000Z");
let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-security-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  resetDatabaseRuntimeForTests();
  const runtime = await getDatabaseRuntime();
  await runMigrations(runtime);
  await runtime.execute(
    `
        INSERT INTO auth_users (
          id, email, normalized_email, display_name, role, locale,
          created_at, updated_at
        )
        VALUES (
          'user_1', 'user@example.test', 'user@example.test',
          'Privacy User', 'user', 'en', $1, $1
        )
      `,
    [fixedNow.toISOString()],
  );
}, 60_000);

afterEach(async () => {
  const runtime = await getDatabaseRuntime();
  await runtime.close();
  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
}, 60_000);

describe("security service", () => {
  it("enforces durable rate limits without storing raw identifiers", async () => {
    const service = createSecurityService({
      now: () => fixedNow,
      secret: "test-security-secret",
    });

    expect(
      await service.consumeRateLimit({
        identifier: "198.51.100.1",
        limit: 1,
        scope: "contact",
        windowSeconds: 60,
      }),
    ).toMatchObject({ allowed: true, remaining: 0 });
    expect(
      await service.consumeRateLimit({
        identifier: "198.51.100.1",
        limit: 1,
        scope: "contact",
        windowSeconds: 60,
      }),
    ).toMatchObject({ allowed: false, retryAfterSeconds: 60 });
    expect(
      await service.consumeRateLimit({
        identifier: "198.51.100.1",
        limit: 1,
        scope: "contact",
        windowSeconds: 60,
      }),
    ).toMatchObject({ allowed: false, retryAfterSeconds: 60 });

    const runtime = await getDatabaseRuntime();
    const buckets = await runtime.execute<{
      count: number;
      identifier: string;
    }>("SELECT count, identifier FROM rate_limit_buckets");
    expect(buckets).toHaveLength(1);
    expect(Number(buckets[0]?.count)).toBe(3);
    expect(buckets[0]?.identifier).not.toContain("198.51.100.1");
    const audit = await runtime.execute<{ event_type: string }>(
      "SELECT event_type FROM security_audit_events",
    );
    expect(audit).toContainEqual({
      event_type: "security.rate_limit.exceeded",
    });
    expect(
      audit.filter(
        (event) => event.event_type === "security.rate_limit.exceeded",
      ),
    ).toHaveLength(1);
  }, 60_000);

  it("records legal acceptance and completes a portable privacy export", async () => {
    const service = createSecurityService({
      now: () => fixedNow,
      secret: "test-security-secret",
    });
    const runtime = await getDatabaseRuntime();
    await runtime.execute(
      `
        INSERT INTO auth_users (
          id, email, normalized_email, display_name, role, locale,
          created_at, updated_at
        )
        VALUES (
          'user_2', 'other@example.test', 'other@example.test',
          'Other User', 'user', 'en', $1, $1
        )
      `,
      [fixedNow.toISOString()],
    );
    await runtime.execute(
      `
        INSERT INTO auth_audit_events (
          id, user_id, actor_id, event_type, payload, created_at
        )
        VALUES
          (
            'subject-owned-event', 'user_1', 'user_2',
            'auth.subject-owned', '{"scope":"subject"}'::jsonb, $1
          ),
          (
            'actor-only-event', 'user_2', 'user_1',
            'auth.actor-only', '{"email":"other@example.test"}'::jsonb, $1
          )
      `,
      [fixedNow.toISOString()],
    );
    const document = { slug: "terms", title: "Terms", version: "1" };
    await service.acceptLegalDocument({
      contentHash: fingerprintLegalDocument(document),
      documentSlug: "terms",
      ipAddress: "198.51.100.1",
      locale: "en",
      userAgent: "Test Browser",
      userId: "user_1",
      version: "1",
    });
    const request = await service.requestPrivacyAction({
      type: "data_export",
      userId: "user_1",
    });
    const exported = await service.createPrivacyExport({
      requestId: request.id,
      userId: "user_1",
    });

    expect(await service.listLegalAcceptances("user_1")).toHaveLength(1);
    expect(exported).toMatchObject({
      requestId: request.id,
      schemaVersion: "1",
      userId: "user_1",
    });
    expect(exported.sections.identity).toEqual([
      expect.objectContaining({ email: "user@example.test" }),
    ]);
    expect(exported.sections.authAudit).toEqual([
      expect.objectContaining({ event_type: "auth.subject-owned" }),
    ]);
    const serializedExport = JSON.stringify(exported);
    expect(serializedExport).not.toContain("other@example.test");
    expect(serializedExport).not.toContain("password_hash");
    expect((await service.listPrivacyRequests("user_1"))[0]?.status).toBe(
      "completed",
    );
  }, 60_000);
});
