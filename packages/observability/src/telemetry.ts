import {
  type Attributes,
  metrics,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { redactLogError, redactLogValue } from "./logger";

let telemetryProviders:
  { meter: MeterProvider; tracer: NodeTracerProvider } | undefined;

export function exporterHeaders(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    value
      .split(",")
      .map((item) => {
        const separator = item.indexOf("=");
        if (separator < 1) {
          return undefined;
        }

        const name = item.slice(0, separator).trim();
        const headerValue = item.slice(separator + 1).trim();
        return name && headerValue ? ([name, headerValue] as const) : undefined;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}

export function startOpenTelemetry(
  source: Record<string, string | undefined> = process.env,
) {
  if (telemetryProviders || source.OTEL_SDK_DISABLED === "true") {
    return telemetryProviders;
  }

  const endpoint = source.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "");
  const headers = exporterHeaders(source.OTEL_EXPORTER_OTLP_HEADERS);
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: source.OTEL_SERVICE_NAME ?? "nextjs-saas-web",
  });
  const traceExporter = endpoint
    ? new OTLPTraceExporter({ headers, url: `${endpoint}/v1/traces` })
    : undefined;
  const tracer = new NodeTracerProvider({
    resource,
    spanProcessors: traceExporter
      ? [new BatchSpanProcessor(traceExporter)]
      : [],
  });
  tracer.register();
  const metricReader = endpoint
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          headers,
          url: `${endpoint}/v1/metrics`,
        }),
      })
    : undefined;
  const meter = new MeterProvider({
    readers: metricReader ? [metricReader] : [],
    resource,
  });
  metrics.setGlobalMeterProvider(meter);
  telemetryProviders = { meter, tracer };

  return telemetryProviders;
}

export async function stopOpenTelemetry() {
  if (!telemetryProviders) {
    return;
  }

  const providers = telemetryProviders;
  telemetryProviders = undefined;
  await Promise.all([providers.meter.shutdown(), providers.tracer.shutdown()]);
}

export async function withOpenTelemetrySpan<T>(input: {
  attributes?: Attributes;
  name: string;
  service?: string;
  task: () => Promise<T> | T;
}) {
  const tracer = trace.getTracer(input.service ?? "nextjs-saas");

  return tracer.startActiveSpan(input.name, async (span) => {
    if (input.attributes) {
      span.setAttributes(redactLogValue(input.attributes) as Attributes);
    }

    try {
      const result = await input.task();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const redactedError = redactLogError(error) ?? {
        message: "Unknown error",
        name: "Error",
      };
      span.recordException(redactedError);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: redactedError.message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function getMeter(service = "nextjs-saas") {
  return metrics.getMeter(service);
}
