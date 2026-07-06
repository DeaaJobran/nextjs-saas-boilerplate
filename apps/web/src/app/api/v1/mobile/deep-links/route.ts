import { deepLinkSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ principal, service }) => {
      const body = deepLinkSchema.parse(await request.json().catch(() => ({})));

      return {
        data: await service.createDeepLink({
          expiresAt: body.expiresAt,
          params: body.params,
          principal: principal!,
          route: body.route,
          tenantId: body.tenantId,
        }),
        tenantId: body.tenantId,
      };
    },
    method: "POST",
    request,
    requiredScopes: ["mobile:devices"],
    routeId: "createDeepLink",
  });
}
