import { describe, expect, it } from "vitest";

import { createLogger, redactLogValue } from "./logger";
import type { StructuredLogRecord } from "./types";

describe("structured logger", () => {
  it("redacts secrets recursively and bounds oversized values", () => {
    expect(
      redactLogValue({
        authorization: "Bearer secret",
        nested: { apiKey: "key", safe: "value" },
        payload: "x".repeat(9_000),
      }),
    ).toMatchObject({
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", safe: "value" },
    });
    expect(
      (redactLogValue({ payload: "x".repeat(9_000) }) as { payload: string })
        .payload.length,
    ).toBeLessThan(9_000);
  });

  it("adds stable context and isolates a failed transport", async () => {
    const records: StructuredLogRecord[] = [];
    const logger = createLogger({
      now: () => new Date("2026-08-01T12:00:00.000Z"),
      service: "test-service",
      transports: [
        { id: "failed", write: () => Promise.reject(new Error("offline")) },
        {
          id: "capture",
          write: (record) => {
            records.push(record);
          },
        },
      ],
    }).child({ requestId: "request-1", tenantId: "tenant-1" });

    await expect(
      logger.info("request complete", {
        attributes: { password: "secret", statusCode: 200 },
        category: "request",
      }),
    ).resolves.toMatchObject({ requestId: "request-1" });
    expect(records[0]).toMatchObject({
      attributes: { password: "[REDACTED]", statusCode: 200 },
      category: "request",
      service: "test-service",
      tenantId: "tenant-1",
      timestamp: "2026-08-01T12:00:00.000Z",
    });
  });

  it("redacts credentials from error messages and stacks", async () => {
    const records: StructuredLogRecord[] = [];
    const logger = createLogger({
      service: "test-service",
      transports: [
        {
          id: "capture",
          write: (record) => {
            records.push(record);
          },
        },
      ],
    });
    const error = new Error(
      "Bearer access-token password=hunter2 postgres://admin:db-secret@db.test/app",
    );

    await logger.error("Provider request failed", { error });

    expect(records[0]?.error).toBeDefined();
    expect(JSON.stringify(records[0]?.error)).not.toMatch(
      /access-token|hunter2|db-secret/,
    );
    expect(records[0]?.error).toMatchObject({
      message:
        "Bearer [REDACTED] password=[REDACTED] postgres://[REDACTED]:[REDACTED]@db.test/app",
    });
  });
});
