import { describe, expect, it, vi } from "vitest";

import {
  createStorageMaintenanceHandlers,
  storageMaintenanceJobTypes,
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
      () => new Date("2026-08-01T12:00:00.000Z"),
    );

    await handlers[storageMaintenanceJobTypes.expiredUploadIntents]();
    await handlers[storageMaintenanceJobTypes.orphanedFiles]({
      payload: { olderThanSeconds: 3600 },
    });
    await handlers[storageMaintenanceJobTypes.deletedFiles]({
      payload: { olderThanSeconds: 7200 },
    });

    expect(service.cleanupExpiredUploadIntents).toHaveBeenCalledOnce();
    expect(service.cleanupOrphanedFiles).toHaveBeenCalledWith({
      olderThan: "2026-08-01T11:00:00.000Z",
    });
    expect(service.cleanupDeletedFiles).toHaveBeenCalledWith({
      olderThan: "2026-08-01T10:00:00.000Z",
    });
  });
});
