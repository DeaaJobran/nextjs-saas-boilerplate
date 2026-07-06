import {
  createEventSchema,
  eventQuerySchema,
} from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;

  return handleApiRoute({
    handler: async ({ principal, service }) => {
      const query = eventQuerySchema.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      const result = await service.listEvents({
        cursor: query.cursor,
        eventType: query.eventType,
        limit: query.limit,
        organizationId,
        principal: principal!,
        sort: query.sort,
      });

      return {
        data: {
          events: result.items,
        },
        meta: {
          nextCursor: result.nextCursor,
        },
        tenantId: organizationId,
      };
    },
    method: "GET",
    request,
    requiredScopes: ["events:read"],
    routeId: "listEvents",
    tenantId: organizationId,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;

  return handleApiRoute({
    handler: async ({ context: apiContext, principal, service }) => {
      const body = createEventSchema.parse(
        await request.json().catch(() => ({})),
      );
      const response = await service.withIdempotency({
        handler: async () => ({
          body: await service.createEvent({
            eventType: body.eventType,
            organizationId,
            payload: body.payload,
            principal: principal!,
            subjectId: body.subjectId,
            subjectType: body.subjectType,
          }),
          status: 201,
        }),
        key: apiContext.idempotencyKey,
        requestBody: body,
        scope: "events.create",
        tenantId: organizationId,
      });

      return {
        data: response.body,
        meta: {
          idempotentReplay: response.cached,
        },
        status: response.status,
        tenantId: organizationId,
      };
    },
    method: "POST",
    request,
    requiredScopes: ["events:write"],
    routeId: "createEvent",
    tenantId: organizationId,
  });
}
