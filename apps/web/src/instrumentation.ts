export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [{ startOpenTelemetry }, { observabilityServiceName }] =
    await Promise.all([
      import("@nextjs-saas/observability/telemetry"),
      import("./lib/observability"),
    ]);
  startOpenTelemetry({
    ...process.env,
    OTEL_SERVICE_NAME: observabilityServiceName,
  });
}
