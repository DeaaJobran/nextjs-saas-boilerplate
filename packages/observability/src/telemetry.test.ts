import { trace } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it } from "vitest";

import { exporterHeaders, withOpenTelemetrySpan } from "./telemetry";

afterEach(() => {
  trace.disable();
});

describe("OpenTelemetry integration", () => {
  it("preserves exporter header values after the first equals sign", () => {
    expect(
      exporterHeaders("Authorization=Basic abc==,X-Tenant=tenant-1"),
    ).toEqual({
      Authorization: "Basic abc==",
      "X-Tenant": "tenant-1",
    });
  });

  it("redacts span attributes and exported exceptions", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    provider.register();

    await expect(
      withOpenTelemetrySpan({
        attributes: { authorization: "Bearer attribute-secret" },
        name: "provider request",
        task: () => {
          throw new Error("password=error-secret");
        },
      }),
    ).rejects.toThrow("password=error-secret");
    await provider.forceFlush();

    const span = exporter.getFinishedSpans()[0];
    expect(span?.attributes.authorization).toBe("[REDACTED]");
    expect(JSON.stringify(span?.events)).not.toContain("error-secret");
    expect(span?.status.message).not.toContain("error-secret");

    await provider.shutdown();
  });
});
