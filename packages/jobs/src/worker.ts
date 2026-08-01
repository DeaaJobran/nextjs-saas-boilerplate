import {
  createEmailRuntimeConfiguration,
  createMessagingJobHandlers,
  createMessagingService,
  messagingSchedules,
} from "@nextjs-saas/emails";
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
for (const schedule of createStorageMaintenanceSchedules(
  storageRuntime.adapter.id,
)) {
  await registerCronSchedule(schedule);
}

for (const schedule of messagingSchedules) {
  await registerCronSchedule(schedule);
}
let defaultHandlers: Record<string, WorkerHandler> = {
  healthcheck: async () => {},
  ...createMessagingJobHandlers(messaging),
};
let storageHandlers: Record<string, WorkerHandler> =
  createStorageMaintenanceHandlers(storage, storageRuntime.adapter.id);
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
