import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url().optional(),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PGLITE_DATA_DIR: z.string().trim().min(1).optional(),
  POSTGRES_DB: z.string().trim().min(1).optional(),
  POSTGRES_PASSWORD: z.string().trim().min(1).optional(),
  POSTGRES_PORT: z.coerce.number().int().positive().optional(),
  POSTGRES_USER: z.string().trim().min(1).optional(),
  REDIS_URL: z.url().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  S3_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
  S3_BUCKET: z.string().trim().min(1).optional(),
  S3_CONSOLE_PORT: z.coerce.number().int().positive().optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  S3_PORT: z.coerce.number().int().positive().optional(),
  S3_REGION: z.string().trim().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
  SMTP_FROM: z.email().optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_WEB_PORT: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function createEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `- ${path}: ${issue.message}`;
      })
      .join("\n");

    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return result.data;
}

export const env = createEnv();
