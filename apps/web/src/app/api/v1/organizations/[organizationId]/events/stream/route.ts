import { randomUUID } from "node:crypto";

import { apiFailure } from "@nextjs-saas/api";

import { getApiService, getRequestContext, handleApiOptions } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const service = getApiService();
  const startedAt = Date.now();
  const requestContext = getRequestContext(request);
  const requestId = requestContext.requestId ?? randomUUID();
  const path = new URL(request.url).pathname;
  const { organizationId } = await context.params;
  const headers = {
    ...service.createCorsHeaders(request.headers.get("origin")),
    "cache-control": "no-store",
    "content-type": "text/event-stream; charset=utf-8",
  };

  try {
    const principal = await service.authenticateBearerToken({
      authorizationHeader: request.headers.get("authorization"),
    });

    service.requireScopes(principal, ["events:read"]);

    const result = await service.listEvents({
      limit: 25,
      organizationId,
      principal,
      sort: "desc",
    });
    const body = result.items
      .map(
        (event) =>
          `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join("");

    await service.recordApiRequest({
      context: { ...requestContext, requestId },
      durationMs: Date.now() - startedAt,
      method: "GET",
      path,
      principal,
      routeId: "streamEvents",
      statusCode: 200,
      tenantId: organizationId,
    });

    return new Response(body, { headers });
  } catch (error) {
    const failure = apiFailure(error, requestId);

    await service.recordApiRequest({
      context: { ...requestContext, requestId },
      durationMs: Date.now() - startedAt,
      errorCode: failure.body.code,
      method: "GET",
      path,
      routeId: "streamEvents",
      statusCode: failure.status,
      tenantId: organizationId,
    });

    return Response.json(failure.body, {
      headers,
      status: failure.status,
    });
  }
}
