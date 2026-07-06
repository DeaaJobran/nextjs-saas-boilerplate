import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAuthService } from "@nextjs-saas/auth";
import {
  getDatabaseRuntime,
  type Queryable,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { createTenantService } from "@nextjs-saas/tenant";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiService } from "./service";

let dataDir: string;
let databaseRuntimeOpened = false;
const fixedNow = new Date("2026-07-06T08:00:00.000Z");
const authSecret = "test-auth-secret-with-at-least-32-characters";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-api-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_SECRET = authSecret;
  databaseRuntimeOpened = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  if (databaseRuntimeOpened) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  delete process.env.AUTH_SECRET;
  await rm(dataDir, { force: true, recursive: true });
});

async function getRuntime() {
  databaseRuntimeOpened = true;

  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);

  return runtime;
}

function createServices(client: Queryable) {
  return {
    api: createApiService({
      appBaseUrl: "https://app.example.test",
      authSecret,
      client,
      deepLinkSecret: "test-mobile-deep-link-secret",
      now: () => fixedNow,
    }),
    auth: createAuthService({
      appBaseUrl: "https://app.example.test",
      authSecret,
      client,
      issuer: "Example SaaS",
      now: () => fixedNow,
    }),
    tenant: createTenantService({
      appBaseUrl: "https://app.example.test",
      client,
      now: () => fixedNow,
    }),
  };
}

async function createOwnerScenario(name = "Ada Labs") {
  const runtime = await getRuntime();
  const services = createServices(runtime);
  const user = await services.auth.createUserWithPassword({
    displayName: `${name} Owner`,
    email: `${name.toLowerCase().replaceAll(" ", "-")}@example.test`,
    password: "StrongPass123",
  });
  const organization = await services.tenant.createOrganization({
    actorId: user.id,
    name,
  });

  return { organization, runtime, services, user };
}

describe("public API service", () => {
  it("authenticates tenant API keys, enforces tenant boundaries, and records idempotent usage", async () => {
    const { organization, runtime, services, user } =
      await createOwnerScenario();
    const other = await createOwnerScenario("Grace Labs");
    const createdKey = await services.tenant.createTenantApiKey({
      actorId: user.id,
      name: "Automation",
      organizationId: organization.id,
      scopes: ["tenant:write", "members:read", "api_keys:write", "audit:read"],
    });
    const principal = await services.api.authenticateBearerToken({
      authorizationHeader: `Bearer ${createdKey.secret}`,
    });

    expect(principal.type).toBe("tenant_api_key");
    await expect(
      services.api.getOrganization({
        organizationId: organization.id,
        principal,
      }),
    ).resolves.toMatchObject({ id: organization.id });
    await expect(
      services.api.getOrganization({
        organizationId: other.organization.id,
        principal,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const requestBody = { eventType: "example.created", payload: { ok: true } };
    const first = await services.api.withIdempotency({
      handler: async () => ({
        body: (await services.api.createEvent({
          eventType: requestBody.eventType,
          organizationId: organization.id,
          payload: requestBody.payload,
          principal,
        })) as Record<string, unknown>,
        status: 201,
      }),
      key: "tenant-event-create",
      requestBody,
      scope: "events.create",
      tenantId: organization.id,
    });
    const second = await services.api.withIdempotency({
      handler: async () => {
        throw new Error("idempotent replay should not call handler");
      },
      key: "tenant-event-create",
      requestBody,
      scope: "events.create",
      tenantId: organization.id,
    });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.body.id).toBe(first.body.id);
    await expect(
      services.api.withIdempotency({
        handler: async () => ({
          body: {},
          status: 201,
        }),
        key: "tenant-event-create",
        requestBody: { eventType: "example.changed" },
        scope: "events.create",
        tenantId: organization.id,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });

    await services.api.recordApiRequest({
      context: {
        idempotencyKey: "tenant-event-create",
        requestId: "request_tenant_key",
      },
      method: "POST",
      path: `/api/v1/organizations/${organization.id}/events`,
      principal,
      routeId: "createEvent",
      statusCode: 201,
      tenantId: organization.id,
    });

    const auditRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM api_audit_events WHERE tenant_id = $1 AND request_id = $2",
      [organization.id, "request_tenant_key"],
    );
    const usageRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM api_usage_records WHERE tenant_id = $1 AND route_id = 'createEvent'",
      [organization.id],
    );

    expect(Number(auditRows[0]?.count)).toBeGreaterThan(0);
    expect(Number(usageRows[0]?.count)).toBe(1);
  }, 60_000);

  it("supports personal access tokens, tenant permission checks, and signed webhook delivery records", async () => {
    const { organization, runtime, services, user } =
      await createOwnerScenario("Webhook Labs");
    const token = await services.api.createPersonalAccessToken({
      actorId: user.id,
      name: "Developer token",
      scopes: ["tenant:read", "members:read", "webhooks:write"],
    });
    const principal = await services.api.authenticateBearerToken({
      authorizationHeader: `Bearer ${token.secret}`,
    });
    const members = await services.api.listOrganizationMembers({
      organizationId: organization.id,
      principal,
    });
    const webhook = await services.api.createWebhookEndpoint({
      eventTypes: ["example.created"],
      organizationId: organization.id,
      principal,
      url: "https://hooks.example.test/saas",
    });
    const header = services.api.signWebhookPayload({
      payload: { id: "evt_test" },
      secret: webhook.secret,
      timestamp: Math.floor(fixedNow.getTime() / 1000),
    });
    const delivery = await services.api.testWebhookEndpoint({
      endpointId: webhook.endpoint.id,
      eventType: "example.created",
      organizationId: organization.id,
      payload: { id: "evt_test" },
      principal,
    });

    expect(principal.type).toBe("personal_access_token");
    expect(members.map((member) => member.userId)).toContain(user.id);
    expect(webhook.secret).toMatch(/^nsw_/u);
    expect(
      services.api.verifyWebhookSignature({
        header,
        payload: { id: "evt_test" },
        secret: webhook.secret,
      }),
    ).toBe(true);
    expect(delivery.deliveryId).toBeTruthy();

    const deliveryRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM api_webhook_deliveries WHERE endpoint_id = $1",
      [webhook.endpoint.id],
    );

    expect(Number(deliveryRows[0]?.count)).toBe(1);

    const outsider = await services.auth.createUserWithPassword({
      displayName: "Outside User",
      email: "outside@example.test",
      password: "StrongPass123",
    });
    const outsiderToken = await services.api.createPersonalAccessToken({
      actorId: outsider.id,
      name: "Outside token",
      scopes: ["tenant:read"],
    });
    const outsiderPrincipal = await services.api.authenticateBearerToken({
      authorizationHeader: `Bearer ${outsiderToken.secret}`,
    });

    await expect(
      services.api.getOrganization({
        organizationId: organization.id,
        principal: outsiderPrincipal,
      }),
    ).rejects.toMatchObject({ code: "membership_required" });
  }, 60_000);

  it("supports mobile sessions, token rotation, device revocation, push, deep links, and upload intents", async () => {
    const { organization, services, user } =
      await createOwnerScenario("Mobile Labs");
    const session = await services.api.createMobileSession({
      appVersion: "1.0.0",
      deviceFingerprint: "test-device-fingerprint",
      deviceName: "Test phone",
      email: user.email,
      password: "StrongPass123",
      platform: "ios",
      userAgent: "vitest-mobile",
    });
    const principal = await services.api.authenticateBearerToken({
      authorizationHeader: `Bearer ${session.sessionToken}`,
    });
    const devices = await services.api.listMobileDevices({ principal });

    expect(principal.type).toBe("mobile_session");
    expect(devices).toHaveLength(1);

    const rotated = await services.api.refreshMobileSession({
      appVersion: "1.0.1",
      deviceName: "Test phone",
      refreshToken: session.refreshToken,
    });

    expect(rotated.sessionToken).not.toBe(session.sessionToken);
    await expect(
      services.api.refreshMobileSession({
        refreshToken: session.refreshToken,
      }),
    ).rejects.toMatchObject({ code: "invalid_refresh_token" });

    const rotatedPrincipal = await services.api.authenticateBearerToken({
      authorizationHeader: `Bearer ${rotated.sessionToken}`,
    });

    await services.api.upsertPushSubscription({
      deviceId: session.device.id,
      principal: rotatedPrincipal,
      provider: "apns",
      token: "push-token-value",
      topics: ["tenant.activity"],
    });

    const deepLink = await services.api.createDeepLink({
      params: { organizationId: organization.id },
      principal: rotatedPrincipal,
      route: "/dashboard",
      tenantId: organization.id,
    });

    expect(deepLink.url).toContain("/mobile/deep-links/");

    const upload = await services.api.createMobileUploadIntent({
      byteSize: 128,
      checksumSha256:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      contentType: "image/png",
      fileName: "avatar.png",
      metadata: { purpose: "avatar" },
      principal: rotatedPrincipal,
      tenantId: organization.id,
    });
    const completed = await services.api.completeMobileUploadIntent({
      byteSize: 128,
      checksumSha256:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      contentType: "image/png",
      intentId: upload.id,
      token: upload.token,
    });

    expect(completed.status).toBe("uploaded");

    await services.api.revokeMobileDevice({
      deviceId: session.device.id,
      principal: rotatedPrincipal,
    });
    await expect(
      services.api.authenticateBearerToken({
        authorizationHeader: `Bearer ${rotated.sessionToken}`,
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  }, 60_000);

  it("generates OAuth authorization URLs from configured providers", async () => {
    const runtime = await getRuntime();
    const api = createApiService({
      appBaseUrl: "https://app.example.test",
      authSecret,
      client: runtime,
      now: () => fixedNow,
      oauthAdapters: [
        {
          authorizationEndpoint: "https://idp.example.test/oauth/authorize",
          clientId: "client_test",
          clientSecret: "secret_test",
          mapProfile: () => ({
            displayName: "OAuth User",
            email: "oauth@example.test",
            providerAccountId: "oauth_user",
          }),
          provider: "example",
          scopes: ["openid", "email", "profile"],
          tokenEndpoint: "https://idp.example.test/oauth/token",
          userInfoEndpoint: "https://idp.example.test/oauth/userinfo",
        },
      ],
    });

    expect(api.listOAuthProviders()).toEqual([
      {
        authorizationEndpoint: "https://idp.example.test/oauth/authorize",
        provider: "example",
        scopes: ["openid", "email", "profile"],
      },
    ]);

    const authorization = await api.createOAuthAuthorizationUrl({
      provider: "example",
      redirectUri: "https://app.example.test/api/v1/oauth/callback",
    });

    expect(authorization.url).toContain("code_challenge_method=S256");
    expect(authorization.url).toContain("client_id=client_test");
  }, 30_000);
});
