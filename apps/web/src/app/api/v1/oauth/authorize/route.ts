import { createOAuthAuthorizationSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ service }) => {
      const body = createOAuthAuthorizationSchema.parse(
        await request.json().catch(() => ({})),
      );

      return {
        data: await service.createOAuthAuthorizationUrl(body),
      };
    },
    method: "POST",
    request,
    routeId: "createOAuthAuthorizationUrl",
  });
}
