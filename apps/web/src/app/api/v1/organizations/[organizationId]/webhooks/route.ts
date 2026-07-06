import { createWebhookEndpointSchema } from "@nextjs-saas/api/contracts";

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
    handler: async ({ principal, service }) => ({
      data: {
        webhooks: await service.listWebhookEndpoints({
          organizationId,
          principal: principal!,
        }),
      },
      tenantId: organizationId,
    }),
    method: "GET",
    request,
    requiredScopes: ["webhooks:read"],
    routeId: "listWebhookEndpoints",
    tenantId: organizationId,
  });
}

// react-doctor-disable-next-line react-doctor/webhook-signature-risk -- Authenticated webhook endpoint management route, not an inbound webhook receiver.
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;

  return handleApiRoute({
    handler: async ({ principal, service }) => {
      const body = createWebhookEndpointSchema.parse(
        await request.json().catch(() => ({})),
      );
      const created = await service.createWebhookEndpoint({
        description: body.description,
        eventTypes: body.eventTypes,
        organizationId,
        principal: principal!,
        url: body.url,
      });

      return {
        data: created,
        status: 201,
        tenantId: organizationId,
      };
    },
    method: "POST",
    request,
    requiredScopes: ["webhooks:write"],
    routeId: "createWebhookEndpoint",
    tenantId: organizationId,
  });
}
