import { testWebhookEndpointSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;

  return handleApiRoute({
    handler: async ({ principal, service }) => {
      const body = testWebhookEndpointSchema.parse(
        await request.json().catch(() => ({})),
      );

      return {
        data: await service.testWebhookEndpoint({
          endpointId: body.endpointId,
          eventType: body.eventType,
          organizationId,
          payload: body.payload,
          principal: principal!,
        }),
        status: 202,
        tenantId: organizationId,
      };
    },
    method: "POST",
    request,
    requiredScopes: ["webhooks:write"],
    routeId: "testWebhookEndpoint",
    tenantId: organizationId,
  });
}
