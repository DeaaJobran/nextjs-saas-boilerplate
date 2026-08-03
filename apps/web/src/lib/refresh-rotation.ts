import { createHash } from "node:crypto";

export function createRefreshRotationCoordinator() {
  const rotations = new Map<string, Promise<unknown>>();

  return async function coordinateRefreshRotation<T>(
    refreshToken: string,
    rotate: () => Promise<T>,
  ): Promise<T> {
    const tokenKey = createHash("sha256").update(refreshToken).digest("hex");
    const existing = rotations.get(tokenKey);

    if (existing) {
      return existing as Promise<T>;
    }

    const promise = Promise.resolve().then(rotate);

    // This map avoids duplicate work inside one process. The auth service's
    // browser-bound encrypted result handles waiters on other instances.
    rotations.set(tokenKey, promise);

    try {
      return await promise;
    } finally {
      if (rotations.get(tokenKey) === promise) {
        rotations.delete(tokenKey);
      }
    }
  };
}

export const coordinateRefreshRotation = createRefreshRotationCoordinator();
