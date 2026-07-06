import { describe, expect, it } from "vitest";

import { createEnv } from "./env";

describe("createEnv", () => {
  it("uses safe defaults for local development", () => {
    expect(createEnv({})).toEqual({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NODE_ENV: "development",
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
      }),
    ).toMatchObject({
      DATABASE_URL:
        "postgres://nextjs_saas:nextjs_saas@127.0.0.1:5432/nextjs_saas",
      PGLITE_DATA_DIR: ".local/pglite",
    });
  });
});
