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
});
