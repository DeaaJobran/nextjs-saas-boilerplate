import { createObservabilityService } from "@nextjs-saas/observability";

let service: ReturnType<typeof createObservabilityService> | undefined;

export const observabilityServiceName =
  process.env.OTEL_SERVICE_NAME?.trim() || "nextjs-saas-web";

export function getObservabilityService() {
  service ??= createObservabilityService({
    serviceName: observabilityServiceName,
  });
  return service;
}
