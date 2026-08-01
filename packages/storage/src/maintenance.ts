import type { createStorageService } from "./service";

type StorageService = ReturnType<typeof createStorageService>;

type MaintenanceJob = {
  payload: Record<string, unknown>;
};

function providerKey(providerId: string) {
  return encodeURIComponent(providerId);
}

export function storageMaintenanceQueue(providerId: string) {
  return `storage:${providerKey(providerId)}`;
}

export function createStorageMaintenanceJobTypes(providerId: string) {
  const suffix = providerKey(providerId);

  return {
    deletedFiles: `storage.cleanup.deleted-files.${suffix}`,
    expiredUploadIntents: `storage.cleanup.expired-upload-intents.${suffix}`,
    orphanedFiles: `storage.cleanup.orphaned-files.${suffix}`,
  } as const;
}

export function createStorageMaintenanceSchedules(providerId: string) {
  const jobTypes = createStorageMaintenanceJobTypes(providerId);
  const key = providerKey(providerId);
  const queue = storageMaintenanceQueue(providerId);

  return [
    {
      id: `storage-${key}-expired-upload-intents`,
      intervalSeconds: 60 * 60,
      jobType: jobTypes.expiredUploadIntents,
      name: `Expire abandoned ${providerId} storage upload intents`,
      payload: { providerId },
      queue,
    },
    {
      id: `storage-${key}-orphaned-files`,
      intervalSeconds: 24 * 60 * 60,
      jobType: jobTypes.orphanedFiles,
      name: `Release orphaned ${providerId} storage files`,
      payload: { olderThanSeconds: 24 * 60 * 60, providerId },
      queue,
    },
    {
      id: `storage-${key}-deleted-files`,
      intervalSeconds: 24 * 60 * 60,
      jobType: jobTypes.deletedFiles,
      name: `Purge deleted ${providerId} storage files`,
      payload: { olderThanSeconds: 30 * 24 * 60 * 60, providerId },
      queue,
    },
  ] as const;
}

function olderThan(
  job: MaintenanceJob,
  fallbackSeconds: number,
  now: () => Date,
) {
  const configured = Number(job.payload.olderThanSeconds ?? fallbackSeconds);
  const seconds =
    Number.isFinite(configured) && configured > 0
      ? configured
      : fallbackSeconds;

  return new Date(now().getTime() - seconds * 1000).toISOString();
}

function assertProvider(job: MaintenanceJob, providerId: string) {
  if (job.payload.providerId !== providerId) {
    throw new Error(
      `Storage maintenance job targets provider ${String(job.payload.providerId)}, not ${providerId}.`,
    );
  }
}

export function createStorageMaintenanceHandlers(
  service: StorageService,
  providerId: string,
  now: () => Date = () => new Date(),
) {
  const jobTypes = createStorageMaintenanceJobTypes(providerId);

  return {
    [jobTypes.deletedFiles]: async (job: MaintenanceJob) => {
      assertProvider(job, providerId);
      await service.cleanupDeletedFiles({
        olderThan: olderThan(job, 30 * 24 * 60 * 60, now),
      });
    },
    [jobTypes.expiredUploadIntents]: async (job: MaintenanceJob) => {
      assertProvider(job, providerId);
      await service.cleanupExpiredUploadIntents();
    },
    [jobTypes.orphanedFiles]: async (job: MaintenanceJob) => {
      assertProvider(job, providerId);
      await service.cleanupOrphanedFiles({
        olderThan: olderThan(job, 24 * 60 * 60, now),
      });
    },
  };
}
