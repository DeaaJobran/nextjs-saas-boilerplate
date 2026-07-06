import { pushSubscriptionSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ principal, service }) => {
      const body = pushSubscriptionSchema.parse(
        await request.json().catch(() => ({})),
      );

      await service.upsertPushSubscription({
        deviceId: body.deviceId,
        principal: principal!,
        provider: body.provider,
        token: body.token,
        topics: body.topics,
      });

      return {
        data: {
          subscribed: true,
        },
      };
    },
    method: "POST",
    request,
    requiredScopes: ["mobile:push"],
    routeId: "upsertPushSubscription",
  });
}
