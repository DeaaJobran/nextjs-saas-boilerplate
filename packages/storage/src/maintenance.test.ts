import { describe, expect, it, vi } from "vitest";

import {
  createStorageMaintenanceHandlers,
  createStorageMaintenanceJobTypes,
  createStorageMaintenanceSchedules,
  storageMaintenanceQueue,
} from "./maintenance";

describe("storage maintenance handlers", () => {
  it("maps scheduled jobs to bounded lifecycle cleanup operations", async () => {
    const service = {
      cleanupDeletedFiles: vi.fn().mockResolvedValue(2),
      cleanupExpiredUploadIntents: vi.fn().mockResolvedValue(3),
      cleanupOrphanedFiles: vi.fn().mockResolvedValue(4),
    };
    const handlers = createStorageMaintenanceHandlers(
      service as never,
      "primary",
      () => new Date("2026-08-01T12:00:00.000Z"),
    );
    const jobTypes = createStorageMaintenanceJobTypes("primary");
    const providerPayload = { providerId: "primary" };

    await handlers[jobTypes.expiredUploadIntents]({
      payload: providerPayload,
    });
    await handlers[jobTypes.orphanedFiles]({
      payload: { ...providerPayload, olderThanSeconds: 3600 },
    });
    await handlers[jobTypes.deletedFiles]({
      payload: { ...providerPayload, olderThanSeconds: 7200 },
    });

    expect(service.cleanupExpiredUploadIntents).toHaveBeenCalledOnce();
    expect(service.cleanupOrphanedFiles).toHaveBeenCalledWith({
      olderThan: "2026-08-01T11:00:00.000Z",
    });
    expect(service.cleanupDeletedFiles).toHaveBeenCalledWith({
      olderThan: "2026-08-01T10:00:00.000Z",
    });
  });

  it("routes each provider through distinct schedules and queues", () => {
    const primary = createStorageMaintenanceSchedules("primary");
    const archive = createStorageMaintenanceSchedules("archive");

    expect(primary.map((schedule) => schedule.id)).not.toEqual(
      archive.map((schedule) => schedule.id),
    );
    expect(
      primary.every((schedule) => schedule.queue === "storage:primary"),
    ).toBe(true);
    expect(
      primary.every((schedule) => schedule.payload.providerId === "primary"),
    ).toBe(true);
    expect(storageMaintenanceQueue("archive")).toBe("storage:archive");
  });
});
