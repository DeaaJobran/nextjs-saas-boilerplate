import { describe, expect, it, vi } from "vitest";

import { createRefreshRotationCoordinator } from "./refresh-rotation";

describe("refresh rotation coordinator", () => {
  it("deduplicates only while a rotation is pending", async () => {
    const coordinate = createRefreshRotationCoordinator();
    let completeRotation:
      ((value: { refreshToken: string }) => void) | undefined;
    const rotate = vi.fn(
      () =>
        new Promise<{ refreshToken: string }>((resolve) => {
          completeRotation = resolve;
        }),
    );

    const firstPromise = coordinate("current-refresh", rotate);
    const secondPromise = coordinate("current-refresh", rotate);

    await Promise.resolve();
    expect(rotate).toHaveBeenCalledTimes(1);
    completeRotation?.({ refreshToken: "next-refresh" });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first).toEqual({ refreshToken: "next-refresh" });
    expect(second).toBe(first);
    expect(rotate).toHaveBeenCalledTimes(1);

    rotate.mockResolvedValueOnce({ refreshToken: "later-refresh" });
    await expect(coordinate("current-refresh", rotate)).resolves.toEqual({
      refreshToken: "later-refresh",
    });
    expect(rotate).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed rotations", async () => {
    const coordinate = createRefreshRotationCoordinator();
    const rotate = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("stale token"))
      .mockResolvedValueOnce("rotated");

    await expect(coordinate("refresh", rotate)).rejects.toThrow("stale token");
    await expect(coordinate("refresh", rotate)).resolves.toBe("rotated");
    expect(rotate).toHaveBeenCalledTimes(2);
  });
});
