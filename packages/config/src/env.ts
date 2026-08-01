import { z } from "zod";

const envSchema = z.object({
  AUTH_ALLOW_ADMIN_BYPASS: z.stringbool().default(false),
  AUTH_SECRET: z.string().trim().min(32).optional(),
  DATABASE_URL: z.url().optional(),
  EMAIL_BRAND_ACCENT: z.string().trim().min(1).optional(),
  EMAIL_BRAND_LOGO_URL: z.url().optional(),
  EMAIL_BRAND_NAME: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().trim().min(3).optional(),
  EMAIL_PREVIEW_DIR: z.string().trim().min(1).optional(),
  EMAIL_PROVIDER: z
    .enum(["preview", "smtp", "resend", "postmark", "mailgun"])
    .default("preview"),
  EMAIL_SUPPORT_ADDRESS: z.email().optional(),
  MAILGUN_API_BASE_URL: z.url().optional(),
  MAILGUN_API_KEY: z.string().trim().min(1).optional(),
  MAILGUN_DOMAIN: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  OBSERVABILITY_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
  OBSERVABILITY_UPTIME_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  OBSERVABILITY_UPTIME_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().trim().min(1).optional(),
  OTEL_SDK_DISABLED: z.stringbool().optional(),
  OTEL_SERVICE_NAME: z.string().trim().min(1).optional(),
  PGLITE_DATA_DIR: z.string().trim().min(1).optional(),
  POSTGRES_DB: z.string().trim().min(1).optional(),
  POSTGRES_PASSWORD: z.string().trim().min(1).optional(),
  POSTGRES_PORT: z.coerce.number().int().positive().optional(),
  POSTGRES_USER: z.string().trim().min(1).optional(),
  POSTMARK_API_BASE_URL: z.url().optional(),
  POSTMARK_SERVER_TOKEN: z.string().trim().min(1).optional(),
  REDIS_URL: z.url().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  RESEND_API_BASE_URL: z.url().optional(),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
  S3_BUCKET: z.string().trim().min(1).optional(),
  S3_CONSOLE_PORT: z.coerce.number().int().positive().optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  S3_PORT: z.coerce.number().int().positive().optional(),
  S3_REGION: z.string().trim().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
  S3_SESSION_TOKEN: z.string().trim().min(1).optional(),
  SMTP_FROM: z.email().optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PASSWORD: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_WEB_PORT: z.coerce.number().int().positive().optional(),
  STORAGE_LOCAL_ROOT: z.string().trim().min(1).optional(),
  STORAGE_PROVIDER_ID: z.string().trim().min(1).optional(),
  STORAGE_PROVIDER_KIND: z
    .enum(["local", "s3", "wasabi", "minio", "r2"])
    .default("local"),
  STORAGE_PROVIDER_NAME: z.string().trim().min(1).optional(),
  STORAGE_PUBLIC_BASE_URL: z.url().optional(),
  STORAGE_SIGNING_SECRET: z.string().trim().min(32).optional(),
  R2_ACCOUNT_ID: z.string().trim().min(1).optional(),
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
