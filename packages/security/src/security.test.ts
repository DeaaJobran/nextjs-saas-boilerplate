import { describe, expect, it } from "vitest";
import { z } from "zod";

import { checkBotProtection } from "./bot";
import { createContentSecurityPolicy, createSecurityHeaders } from "./headers";
import { isMfaRequiredForRole } from "./mfa";
import {
  assertTrustedOrigin,
  createCorsHeaders,
  getAllowedOrigins,
  getClientAddress,
  isOriginAllowed,
} from "./origin";
import { parseInput, parseOutput } from "./validation";
import { signWebhookPayload, verifyWebhookSignature } from "./webhooks";

describe("security policies", () => {
  it("creates production headers and a restrictive content policy", () => {
    const source = {
      NODE_ENV: "production",
      SECURITY_CSP_IMAGE_SRC: "https://cdn.example.test",
    };
    const headers = Object.fromEntries(
      createSecurityHeaders(source).map((header) => [header.key, header.value]),
    );

    expect(headers["Strict-Transport-Security"]).toContain("preload");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(createContentSecurityPolicy(source)).toContain(
      "frame-ancestors 'none'",
    );
    expect(createContentSecurityPolicy(source)).toContain(
      "img-src 'self' blob: data: https://cdn.example.test",
    );
  });

  it("allows configured CORS origins and omits allow-origin for denied origins", () => {
    const allowedOrigins = getAllowedOrigins({
      appBaseUrl: "https://app.example.test/path",
      configuredOrigins: "https://mobile.example.test",
    });

    expect(
      createCorsHeaders({
        allowedOrigins,
        origin: "https://mobile.example.test",
      })["access-control-allow-origin"],
    ).toBe("https://mobile.example.test");
    expect(
      createCorsHeaders({
        allowedOrigins,
        origin: "https://attacker.example",
      }),
    ).not.toHaveProperty("access-control-allow-origin");
    expect(() =>
      assertTrustedOrigin({
        allowedOrigins,
        origin: "https://attacker.example",
        requireOrigin: true,
      }),
    ).toThrow("not allowed");
  });

  it("accepts the hostname and wildcard formats used by Next.js Server Actions", () => {
    const allowedOrigins = getAllowedOrigins({
      appBaseUrl: "https://app.example.test",
      configuredOrigins:
        "localhost:3000,*.example.com,https://*.partners.example",
    });

    expect(isOriginAllowed("http://localhost:3000", allowedOrigins)).toBe(true);
    expect(isOriginAllowed("https://admin.example.com", allowedOrigins)).toBe(
      true,
    );
    expect(
      isOriginAllowed("https://portal.partners.example", allowedOrigins),
    ).toBe(true);
    expect(
      isOriginAllowed("https://portal.partners.example:444", allowedOrigins),
    ).toBe(false);
    expect(isOriginAllowed("https://example.com", allowedOrigins)).toBe(false);
    expect(
      isOriginAllowed("http://portal.partners.example", allowedOrigins),
    ).toBe(false);
  });

  it("preserves explicit ports in protocol-agnostic host patterns", () => {
    const allowedOrigins = getAllowedOrigins({
      appBaseUrl: "https://app.example.test",
      configuredOrigins: "*.example.com:443",
    });

    expect(allowedOrigins).toContain("*.example.com:443");
    expect(isOriginAllowed("https://portal.example.com", allowedOrigins)).toBe(
      true,
    );
    expect(isOriginAllowed("http://portal.example.com", allowedOrigins)).toBe(
      false,
    );
    expect(
      isOriginAllowed("http://portal.example.com:443", allowedOrigins),
    ).toBe(true);
  });

  it("resolves client addresses only through explicitly trusted proxies", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1, 10.0.0.2",
      "x-real-ip": "10.0.0.2",
    });

    expect(getClientAddress(headers, 0)).toBeUndefined();
    expect(getClientAddress(headers, 2)).toBe("198.51.100.1");
  });

  it("verifies signed webhooks with replay tolerance", () => {
    const payload = '{"event":"paid"}';
    const signatureHeader = signWebhookPayload({
      payload,
      secret: "webhook-secret",
      timestamp: 1_786_000_000,
    });

    expect(() =>
      verifyWebhookSignature({
        now: new Date(1_786_000_100_000),
        payload,
        secret: "webhook-secret",
        signatureHeader,
      }),
    ).not.toThrow();
    expect(() =>
      verifyWebhookSignature({
        now: new Date(1_786_001_000_000),
        payload,
        secret: "webhook-secret",
        signatureHeader,
      }),
    ).toThrow("outside tolerance");
  });

  it("supports bot hooks, role MFA policy, and schema-bound I/O", async () => {
    expect(
      await checkBotProtection({ action: "contact", honeypot: "spam" }),
    ).toMatchObject({ allowed: false, reason: "honeypot" });
    expect(
      isMfaRequiredForRole("owner", {
        SECURITY_MFA_ENFORCED_ROLES: "owner,admin",
      }),
    ).toBe(true);
    const schema = z.object({ value: z.string().min(1) });
    expect(parseInput(schema, { value: "safe" })).toEqual({ value: "safe" });
    expect(parseOutput(schema, { value: "safe" })).toEqual({ value: "safe" });
  });
});
