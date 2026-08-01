import type { z } from "zod";

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export function parseOutput<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
