# Observability

`@nextjs-saas/observability` provides structured and redacted logging, durable
metrics and spans, OpenTelemetry OTLP HTTP export, dependency readiness checks,
uptime monitoring, audit aggregation, and retention jobs.

The web app starts telemetry from Next.js instrumentation and exposes separate
`/api/v1/health` liveness and `/api/v1/readiness` dependency checks. The jobs
worker registers uptime and retention schedules and wraps every handler with
correlated logs and spans. Administrators can inspect current health and recent
operational data at `/admin/observability`.

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to an OpenTelemetry-compatible collector base
URL to export traces and metrics. Optional exporter headers use a comma-separated
`name=value` format. Database telemetry remains enabled without an external
collector. Retention, uptime interval, and timeout are configured with the
`OBSERVABILITY_*` environment variables documented in `.env.example`.
