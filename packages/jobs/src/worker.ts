import {
  createStorageMaintenanceHandlers,
  createStorageMaintenanceSchedules,
  createStorageRuntimeConfiguration,
  createStorageService,
  storageMaintenanceQueue,
} from "@nextjs-saas/storage";

import { registerCronSchedule, runWorker } from "./index";

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

for (const schedule of createStorageMaintenanceSchedules(
  storageRuntime.adapter.id,
)) {
  await registerCronSchedule(schedule);
}

await runWorker({
  handlers: {
    healthcheck: async () => {},
    ...createStorageMaintenanceHandlers(storage, storageRuntime.adapter.id),
  },
  queue: storageMaintenanceQueue(storageRuntime.adapter.id),
  signal: abortController.signal,
  workerId: `worker-${process.pid}`,
});
