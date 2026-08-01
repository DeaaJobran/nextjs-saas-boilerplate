import type { createStorageService } from "./service";

type StorageService = ReturnType<typeof createStorageService>;

type MaintenanceJob = {
  payload: Record<string, unknown>;
};

export const storageMaintenanceJobTypes = {
  deletedFiles: "storage.cleanup.deleted-files",
  expiredUploadIntents: "storage.cleanup.expired-upload-intents",
  orphanedFiles: "storage.cleanup.orphaned-files",
} as const;

export const storageMaintenanceSchedules = [
  {
    id: "storage-expired-upload-intents",
    intervalSeconds: 60 * 60,
    jobType: storageMaintenanceJobTypes.expiredUploadIntents,
    name: "Expire abandoned storage upload intents",
  },
  {
    id: "storage-orphaned-files",
    intervalSeconds: 24 * 60 * 60,
    jobType: storageMaintenanceJobTypes.orphanedFiles,
    name: "Release orphaned storage files",
    payload: { olderThanSeconds: 24 * 60 * 60 },
  },
  {
    id: "storage-deleted-files",
    intervalSeconds: 24 * 60 * 60,
    jobType: storageMaintenanceJobTypes.deletedFiles,
    name: "Purge deleted storage files",
    payload: { olderThanSeconds: 30 * 24 * 60 * 60 },
  },
] as const;

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

export function createStorageMaintenanceHandlers(
  service: StorageService,
  now: () => Date = () => new Date(),
) {
  return {
    [storageMaintenanceJobTypes.deletedFiles]: async (job: MaintenanceJob) => {
      await service.cleanupDeletedFiles({
        olderThan: olderThan(job, 30 * 24 * 60 * 60, now),
      });
    },
    [storageMaintenanceJobTypes.expiredUploadIntents]: async () => {
      await service.cleanupExpiredUploadIntents();
    },
    [storageMaintenanceJobTypes.orphanedFiles]: async (job: MaintenanceJob) => {
      await service.cleanupOrphanedFiles({
        olderThan: olderThan(job, 24 * 60 * 60, now),
      });
    },
  };
}
