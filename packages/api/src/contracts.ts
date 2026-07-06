import { z } from "zod";

export const apiVersion = "v1";

export const apiErrorSchema = {
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    details: { additionalProperties: true, type: "object" },
    message: { type: "string" },
    requestId: { type: "string" },
  },
  required: ["code", "message", "requestId"],
  type: "object",
} as const;

export const apiResponseSchema = {
  additionalProperties: false,
  properties: {
    data: {},
    meta: { additionalProperties: true, type: "object" },
  },
  required: ["data"],
  type: "object",
} as const;

export const apiResponseEnvelopeSchema = z.object({
  data: z.unknown(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const apiScopeCatalog = [
  "*",
  "api:read",
  "api:write",
  "tenant:read",
  "tenant:write",
  "members:read",
  "members:write",
  "invitations:read",
  "invitations:write",
  "api_keys:read",
  "api_keys:write",
  "feature_flags:read",
  "feature_flags:write",
  "limits:read",
  "limits:write",
  "billing:read",
  "billing:write",
  "audit:read",
  "events:read",
  "events:write",
  "webhooks:read",
  "webhooks:write",
  "mobile:sessions",
  "mobile:devices",
  "mobile:push",
  "mobile:uploads",
  "openid",
  "offline_access",
] as const;

export type ApiScope = (typeof apiScopeCatalog)[number];

export type ApiRouteContract = {
  description: string;
  id: string;
  method: "DELETE" | "GET" | "POST" | "PUT";
  path: string;
  requiredScopes: ApiScope[];
  summary: string;
  tags: string[];
};

export const apiRouteCatalog = [
  {
    description: "Reports API availability and the active version.",
    id: "getHealth",
    method: "GET",
    path: "/api/v1/health",
    requiredScopes: [],
    summary: "Health check",
    tags: ["System"],
  },
  {
    description: "Returns the generated OpenAPI 3.1 document.",
    id: "getOpenApi",
    method: "GET",
    path: "/api/v1/openapi.json",
    requiredScopes: [],
    summary: "OpenAPI specification",
    tags: ["System"],
  },
  {
    description:
      "Returns a generated TypeScript SDK helper for the current API contract catalog.",
    id: "getTypeScriptSdk",
    method: "GET",
    path: "/api/v1/sdk/typescript",
    requiredScopes: [],
    summary: "TypeScript SDK",
    tags: ["System"],
  },
  {
    description:
      "Returns the authenticated API principal and scoped organization context.",
    id: "getMe",
    method: "GET",
    path: "/api/v1/me",
    requiredScopes: ["api:read"],
    summary: "Current API principal",
    tags: ["Identity"],
  },
  {
    description:
      "Lists OAuth/OIDC providers configured for mobile or third-party authorization flows.",
    id: "listOAuthProviders",
    method: "GET",
    path: "/api/v1/oauth/providers",
    requiredScopes: [],
    summary: "OAuth provider metadata",
    tags: ["Identity"],
  },
  {
    description:
      "Creates a PKCE authorization URL for a configured OAuth/OIDC provider.",
    id: "createOAuthAuthorizationUrl",
    method: "POST",
    path: "/api/v1/oauth/authorize",
    requiredScopes: [],
    summary: "OAuth authorization URL",
    tags: ["Identity"],
  },
  {
    description:
      "Completes an OAuth/OIDC callback and returns mobile-safe session tokens.",
    id: "completeOAuthCallback",
    method: "POST",
    path: "/api/v1/oauth/callback",
    requiredScopes: [],
    summary: "OAuth callback exchange",
    tags: ["Identity"],
  },
  {
    description: "Reads an organization through tenant-aware authorization.",
    id: "getOrganization",
    method: "GET",
    path: "/api/v1/organizations/{organizationId}",
    requiredScopes: ["tenant:read"],
    summary: "Organization detail",
    tags: ["Organizations"],
  },
  {
    description:
      "Lists active organization members with tenant-aware access checks.",
    id: "listOrganizationMembers",
    method: "GET",
    path: "/api/v1/organizations/{organizationId}/members",
    requiredScopes: ["members:read"],
    summary: "Organization members",
    tags: ["Organizations"],
  },
  {
    description:
      "Lists tenant events with cursor pagination, filtering, and sorting.",
    id: "listEvents",
    method: "GET",
    path: "/api/v1/organizations/{organizationId}/events",
    requiredScopes: ["events:read"],
    summary: "Tenant events",
    tags: ["Events"],
  },
  {
    description: "Creates a tenant event and queues webhook fanout.",
    id: "createEvent",
    method: "POST",
    path: "/api/v1/organizations/{organizationId}/events",
    requiredScopes: ["events:write"],
    summary: "Create event",
    tags: ["Events"],
  },
  {
    description: "Streams recent tenant events as server-sent events.",
    id: "streamEvents",
    method: "GET",
    path: "/api/v1/organizations/{organizationId}/events/stream",
    requiredScopes: ["events:read"],
    summary: "Realtime event stream",
    tags: ["Events"],
  },
  {
    description: "Lists webhook endpoints for a tenant.",
    id: "listWebhookEndpoints",
    method: "GET",
    path: "/api/v1/organizations/{organizationId}/webhooks",
    requiredScopes: ["webhooks:read"],
    summary: "Webhook endpoints",
    tags: ["Webhooks"],
  },
  {
    description:
      "Creates a webhook endpoint and returns its signing secret once.",
    id: "createWebhookEndpoint",
    method: "POST",
    path: "/api/v1/organizations/{organizationId}/webhooks",
    requiredScopes: ["webhooks:write"],
    summary: "Create webhook endpoint",
    tags: ["Webhooks"],
  },
  {
    description: "Signs and records a test delivery for a webhook endpoint.",
    id: "testWebhookEndpoint",
    method: "POST",
    path: "/api/v1/organizations/{organizationId}/webhooks/test",
    requiredScopes: ["webhooks:write"],
    summary: "Test webhook endpoint",
    tags: ["Webhooks"],
  },
  {
    description:
      "Creates a mobile session using email/password credentials and device metadata.",
    id: "createMobileSession",
    method: "POST",
    path: "/api/v1/mobile/sessions",
    requiredScopes: [],
    summary: "Mobile sign-in",
    tags: ["Mobile"],
  },
  {
    description:
      "Rotates a mobile refresh token and updates the device/session registry.",
    id: "refreshMobileSession",
    method: "POST",
    path: "/api/v1/mobile/sessions/refresh",
    requiredScopes: [],
    summary: "Mobile token refresh",
    tags: ["Mobile"],
  },
  {
    description: "Lists active devices for the authenticated mobile user.",
    id: "listMobileDevices",
    method: "GET",
    path: "/api/v1/mobile/devices",
    requiredScopes: ["mobile:devices"],
    summary: "Mobile devices",
    tags: ["Mobile"],
  },
  {
    description: "Revokes a mobile device and all linked mobile sessions.",
    id: "revokeMobileDevice",
    method: "DELETE",
    path: "/api/v1/mobile/devices/{deviceId}",
    requiredScopes: ["mobile:devices"],
    summary: "Revoke mobile device",
    tags: ["Mobile"],
  },
  {
    description:
      "Registers or updates a push notification token for a mobile device.",
    id: "upsertPushSubscription",
    method: "POST",
    path: "/api/v1/mobile/push-subscriptions",
    requiredScopes: ["mobile:push"],
    summary: "Push subscription",
    tags: ["Mobile"],
  },
  {
    description: "Creates a signed deep link for mobile navigation.",
    id: "createDeepLink",
    method: "POST",
    path: "/api/v1/mobile/deep-links",
    requiredScopes: ["mobile:devices"],
    summary: "Create deep link",
    tags: ["Mobile"],
  },
  {
    description: "Creates a short-lived upload intent for mobile clients.",
    id: "createMobileUploadIntent",
    method: "POST",
    path: "/api/v1/mobile/uploads",
    requiredScopes: ["mobile:uploads"],
    summary: "Create upload intent",
    tags: ["Mobile"],
  },
  {
    description: "Completes a token-bound mobile upload intent.",
    id: "completeMobileUploadIntent",
    method: "PUT",
    path: "/api/v1/mobile/uploads/{intentId}",
    requiredScopes: [],
    summary: "Complete upload intent",
    tags: ["Mobile"],
  },
] as const satisfies ApiRouteContract[];

const nonEmptyString = z.string().trim().min(1);
const apiScopeSchema = z.enum(apiScopeCatalog);

export const paginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export const eventQuerySchema = paginationQuerySchema.extend({
  eventType: z.string().trim().min(1).max(160).optional(),
});

export const createEventSchema = z.object({
  eventType: nonEmptyString.max(160),
  payload: z.record(z.string(), z.unknown()).default({}),
  subjectId: z.string().trim().min(1).max(160).optional(),
  subjectType: z.string().trim().min(1).max(160).optional(),
});

export const createOAuthAuthorizationSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).default({}),
  provider: nonEmptyString.max(80),
  redirectUri: z.string().url(),
});

export const completeOAuthCallbackSchema = z.object({
  code: nonEmptyString,
  device: z
    .object({
      appVersion: z.string().trim().max(80).optional(),
      deviceFingerprint: z.string().trim().max(500).optional(),
      deviceName: nonEmptyString.max(160),
      platform: nonEmptyString.max(80),
    })
    .optional(),
  provider: nonEmptyString.max(80),
  redirectUri: z.string().url(),
  state: nonEmptyString,
});

export const createPersonalAccessTokenSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  name: nonEmptyString.max(160),
  scopes: z.array(apiScopeSchema).min(1),
});

export const createWebhookEndpointSchema = z.object({
  description: z.string().trim().max(500).optional(),
  eventTypes: z.array(nonEmptyString.max(160)).min(1).max(100),
  url: z.string().url(),
});

export const testWebhookEndpointSchema = z.object({
  endpointId: nonEmptyString,
  eventType: nonEmptyString.max(160).default("webhook.test"),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const mobileSessionSchema = z.object({
  appVersion: z.string().trim().max(80).optional(),
  deviceFingerprint: z.string().trim().max(500).optional(),
  deviceName: nonEmptyString.max(160),
  email: z.string().email(),
  mfaCode: z.string().trim().min(1).max(32).optional(),
  password: z.string().min(1),
  platform: nonEmptyString.max(80),
});

export const refreshMobileSessionSchema = z.object({
  appVersion: z.string().trim().max(80).optional(),
  deviceName: z.string().trim().max(160).optional(),
  refreshToken: nonEmptyString,
});

export const pushSubscriptionSchema = z.object({
  deviceId: nonEmptyString,
  provider: nonEmptyString.max(80),
  token: nonEmptyString,
  topics: z.array(nonEmptyString.max(120)).max(100).default([]),
});

export const deepLinkSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  route: nonEmptyString.max(240),
  tenantId: z.string().trim().min(1).optional(),
});

export const mobileUploadIntentSchema = z.object({
  byteSize: z
    .number()
    .int()
    .min(1)
    .max(250 * 1024 * 1024),
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  contentType: nonEmptyString.max(120),
  fileName: nonEmptyString.max(240),
  metadata: z.record(z.string(), z.unknown()).default({}),
  tenantId: nonEmptyString,
});

export const completeMobileUploadSchema = z.object({
  byteSize: z.number().int().min(1),
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  contentType: nonEmptyString.max(120),
  token: nonEmptyString,
});

function pathToOpenApiPath(path: string) {
  return path;
}

function extractPathParameters(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/gu)].map((match) => ({
    in: "path",
    name: match[1],
    required: true,
    schema: { type: "string" },
  }));
}

function routeSecurity(route: ApiRouteContract) {
  return route.requiredScopes.length > 0
    ? [{ bearerAuth: route.requiredScopes }]
    : [];
}

export function generateOpenApiSpec(input: {
  baseUrl: string;
  title: string;
  version: string;
}) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of apiRouteCatalog) {
    const path = pathToOpenApiPath(route.path);
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = {
      description: route.description,
      operationId: route.id,
      parameters: extractPathParameters(route.path),
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: apiResponseSchema,
            },
          },
          description: "Successful response",
        },
        "400": {
          content: {
            "application/json": {
              schema: apiErrorSchema,
            },
          },
          description: "Validation or request error",
        },
        "401": {
          content: {
            "application/json": {
              schema: apiErrorSchema,
            },
          },
          description: "Authentication required",
        },
        "403": {
          content: {
            "application/json": {
              schema: apiErrorSchema,
            },
          },
          description: "Forbidden",
        },
      },
      security: routeSecurity(route),
      summary: route.summary,
      tags: route.tags,
    };
  }

  return {
    components: {
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "API key or personal access token",
          scheme: "bearer",
          type: "http",
        },
      },
    },
    info: {
      title: input.title,
      version: input.version,
    },
    openapi: "3.1.0",
    paths,
    servers: [{ url: input.baseUrl }],
  };
}

export function generateTypeScriptSdk(input: { packageName: string }) {
  const routeUnion = apiRouteCatalog
    .map(
      (route) =>
        `  | { id: "${route.id}"; method: "${route.method}"; path: "${route.path}" }`,
    )
    .join("\n");
  const routes = JSON.stringify(apiRouteCatalog, null, 2);

  return `// Generated from ${input.packageName} API contracts.
export type ApiRoute =
${routeUnion};

export type ApiClientOptions = {
  baseUrl: string;
  token?: string;
};

export const apiRoutes = ${routes} as const;

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(new URL(path, this.options.baseUrl), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.options.token
          ? { authorization: \`Bearer \${this.options.token}\` }
          : {}),
        ...init.headers,
      },
    });

    const body = await response.json();

    if (!response.ok) {
      throw Object.assign(new Error(body.message ?? "API request failed."), body);
    }

    return body.data as T;
  }
}
`;
}
