import { randomUUID } from "node:crypto";

import {
  apiFailure,
  type ApiPrincipal,
  type ApiRequestContext,
  apiSuccess,
  createApiService,
} from "@nextjs-saas/api";
import { appConfig } from "@nextjs-saas/config/app";
import { NextResponse } from "next/server";

export function getApiService() {
  return createApiService({
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
    authSecret: process.env.AUTH_SECRET,
  });
}

export function getRequestContext(request: Request): ApiRequestContext {
  return {
    idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      undefined,
    requestId: request.headers.get("x-request-id") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

type ApiRouteHandlerInput = {
  context: ApiRequestContext;
  principal?: ApiPrincipal;
  service: ReturnType<typeof createApiService>;
};

type ApiRouteHandlerResult<T> = {
  data: T;
  meta?: Record<string, unknown>;
  status?: number;
  tenantId?: string;
};

type ApiRouteConfig<T> = {
  authenticate?: boolean;
  handler: (
    input: ApiRouteHandlerInput,
  ) => Promise<ApiRouteHandlerResult<T>> | ApiRouteHandlerResult<T>;
  method: string;
  path?: string;
  requiredScopes?: readonly string[];
  request: Request;
  routeId: string;
  tenantId?: string;
};

export async function handleApiOptions(request: Request) {
  const service = getApiService();

  return new NextResponse(null, {
    headers: service.createCorsHeaders(request.headers.get("origin")),
    status: 204,
  });
}

export async function handleApiRoute<T>(config: ApiRouteConfig<T>) {
  const service = getApiService();
  const startedAt = Date.now();
  const context = getRequestContext(config.request);
  const requestId = context.requestId ?? randomUUID();
  const path = config.path ?? new URL(config.request.url).pathname;
  const method = config.method.toUpperCase();
  const corsHeaders = service.createCorsHeaders(
    config.request.headers.get("origin"),
  );
  let principal: ApiPrincipal | undefined;
  let tenantId: string | undefined = config.tenantId;

  try {
    const shouldAuthenticate =
      config.authenticate ?? (config.requiredScopes?.length ?? 0) > 0;

    if (shouldAuthenticate) {
      principal = await service.authenticateBearerToken({
        authorizationHeader: config.request.headers.get("authorization"),
      });

      if (config.requiredScopes?.length) {
        service.requireScopes(principal, config.requiredScopes);
      }
    }

    const result = await config.handler({
      context: { ...context, requestId },
      principal,
      service,
    });

    tenantId = result.tenantId;

    await service.recordApiRequest({
      context: { ...context, requestId },
      durationMs: Date.now() - startedAt,
      method,
      path,
      principal,
      routeId: config.routeId,
      statusCode: result.status ?? 200,
      tenantId,
    });

    return NextResponse.json(apiSuccess(result.data, result.meta), {
      headers: corsHeaders,
      status: result.status ?? 200,
    });
  } catch (error) {
    const failure = apiFailure(error, requestId);

    await service.recordApiRequest({
      context: { ...context, requestId },
      durationMs: Date.now() - startedAt,
      errorCode: failure.body.code,
      method,
      path,
      principal,
      routeId: config.routeId,
      statusCode: failure.status,
      tenantId,
    });

    return NextResponse.json(failure.body, {
      headers: corsHeaders,
      status: failure.status,
    });
  }
}

export function apiInfo() {
  return {
    name: appConfig.name,
    shortName: appConfig.shortName,
    version: process.env.npm_package_version ?? "0.3.0",
  };
}
