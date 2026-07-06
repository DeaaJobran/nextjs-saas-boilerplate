import { describe, expect, it } from "vitest";

import { createEnv } from "./env";

describe("createEnv", () => {
  it("uses safe defaults for local development", () => {
    expect(createEnv({})).toEqual({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NODE_ENV: "development",
      S3_FORCE_PATH_STYLE: false,
    });
  });

  it("rejects invalid public app URLs", () => {
    expect(() =>
      createEnv({
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("accepts database runtime configuration", () => {
    expect(
      createEnv({
        DATABASE_URL:
          "postgres://nextjs_saas:nextjs_saas@127.0.0.1:5432/nextjs_saas",
        PGLITE_DATA_DIR: ".local/pglite",
        POSTGRES_DB: "nextjs_saas",
        POSTGRES_PASSWORD: "nextjs_saas",
        POSTGRES_PORT: "5432",
        POSTGRES_USER: "nextjs_saas",
      }),
    ).toMatchObject({
      DATABASE_URL:
        "postgres://nextjs_saas:nextjs_saas@127.0.0.1:5432/nextjs_saas",
      PGLITE_DATA_DIR: ".local/pglite",
      POSTGRES_PORT: 5432,
    });
  });

  it("accepts local service configuration", () => {
    expect(
      createEnv({
        REDIS_URL: "redis://127.0.0.1:6379",
        REDIS_PORT: "6379",
        S3_ACCESS_KEY_ID: "minioadmin",
        S3_BUCKET: "nextjs-saas",
        S3_CONSOLE_PORT: "9001",
        S3_ENDPOINT: "http://127.0.0.1:9000",
        S3_FORCE_PATH_STYLE: "true",
        S3_PORT: "9000",
        S3_REGION: "us-east-1",
        S3_SECRET_ACCESS_KEY: "minioadmin",
        SMTP_FROM: "no-reply@example.test",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "1025",
        SMTP_WEB_PORT: "8025",
      }),
    ).toMatchObject({
      REDIS_URL: "redis://127.0.0.1:6379",
      REDIS_PORT: 6379,
      S3_BUCKET: "nextjs-saas",
      S3_CONSOLE_PORT: 9001,
      S3_FORCE_PATH_STYLE: true,
      S3_PORT: 9000,
      SMTP_PORT: 1025,
      SMTP_WEB_PORT: 8025,
    });
  });
});
