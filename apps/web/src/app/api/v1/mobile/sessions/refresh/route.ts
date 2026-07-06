import { refreshMobileSessionSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ context, service }) => {
      const body = refreshMobileSessionSchema.parse(
        await request.json().catch(() => ({})),
      );

      return {
        data: await service.refreshMobileSession({
          appVersion: body.appVersion,
          deviceName: body.deviceName,
          ipAddress: context.ipAddress,
          refreshToken: body.refreshToken,
          userAgent: context.userAgent,
        }),
      };
    },
    method: "POST",
    request,
    routeId: "refreshMobileSession",
  });
}
