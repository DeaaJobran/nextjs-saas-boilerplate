import {
  createEmailRuntimeConfiguration,
  createMessagingJobHandlers,
  createMessagingService,
  messagingSchedules,
} from "@nextjs-saas/emails";
import {
  createObservabilityJobHandlers,
  createObservabilitySchedules,
  createObservabilityService,
  observeJobHandlers,
  startOpenTelemetry,
  stopOpenTelemetry,
} from "@nextjs-saas/observability";
import {
  createStorageMaintenanceHandlers,
  createStorageMaintenanceSchedules,
  createStorageRuntimeConfiguration,
  createStorageService,
  storageMaintenanceQueue,
} from "@nextjs-saas/storage";

import { registerCronSchedule, runWorker } from "./index";

type WorkerHandler = (job: {
  id: string;
  payload: Record<string, unknown>;
  tenantId?: string;
  type: string;
}) => Promise<void> | void;

const abortController = new AbortController();

function stopWorker() {
  abortController.abort();
}

process.once("SIGINT", stopWorker);
process.once("SIGTERM", stopWorker);

const storageRuntime = createStorageRuntimeConfiguration();
const storage = createStorageService({
  adapter: storageRuntime.adapter,
  provider: storageRuntime.provider,
});
const emailRuntime = createEmailRuntimeConfiguration();
const messaging = createMessagingService({
  brand: emailRuntime.brand,
  emailProvider: emailRuntime.provider,
  from: emailRuntime.from,
});
const observabilityServiceName =
  process.env.OTEL_SERVICE_NAME?.trim() || "nextjs-saas-background-worker";
const uptimeIntervalSeconds = Number(
  process.env.OBSERVABILITY_UPTIME_INTERVAL_SECONDS ?? 60,
);
startOpenTelemetry({
  ...process.env,
  OTEL_SERVICE_NAME: observabilityServiceName,
});
const observability = createObservabilityService({
  serviceName: observabilityServiceName,
});
await observability.upsertUptimeMonitor({
  intervalSeconds: uptimeIntervalSeconds,
  name: "web-application-liveness",
  timeoutMs: Number(process.env.OBSERVABILITY_UPTIME_TIMEOUT_MS ?? 10_000),
  url: new URL(
    "/api/v1/health",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ).toString(),
});

for (const schedule of createStorageMaintenanceSchedules(
  storageRuntime.adapter.id,
)) {
  await registerCronSchedule(schedule);
}

for (const schedule of messagingSchedules) {
  await registerCronSchedule(schedule);
}

for (const schedule of createObservabilitySchedules(uptimeIntervalSeconds)) {
  await registerCronSchedule(
    schedule.jobType === "observability.retention.cleanup"
      ? {
          ...schedule,
          payload: {
            retentionDays: Number(
              process.env.OBSERVABILITY_RETENTION_DAYS ?? 30,
            ),
          },
        }
      : schedule,
  );
}

let defaultHandlers: Record<string, WorkerHandler> = {
  healthcheck: async () => {},
  ...createMessagingJobHandlers(messaging),
};
defaultHandlers = observeJobHandlers(
  {
    ...defaultHandlers,
    ...createObservabilityJobHandlers(observability),
  },
  observability,
);
let storageHandlers: Record<string, WorkerHandler> =
  createStorageMaintenanceHandlers(storage, storageRuntime.adapter.id);
storageHandlers = observeJobHandlers(storageHandlers, observability);

try {
  await Promise.all([
    runWorker({
      handlers: defaultHandlers,
      signal: abortController.signal,
      workerId: `worker-${process.pid}-default`,
    }),
    runWorker({
      handlers: storageHandlers,
      queue: storageMaintenanceQueue(storageRuntime.adapter.id),
      signal: abortController.signal,
      workerId: `worker-${process.pid}-storage-${storageRuntime.adapter.id}`,
    }),
  ]);
} finally {
  await stopOpenTelemetry();
}
