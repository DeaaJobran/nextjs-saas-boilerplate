export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export function assertStorageCondition(
  condition: unknown,
  message: string,
  code: string,
): asserts condition {
  if (!condition) {
    throw new StorageError(message, code);
  }
}
