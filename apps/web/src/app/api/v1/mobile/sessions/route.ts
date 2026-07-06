import { mobileSessionSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ context, service }) => {
      const body = mobileSessionSchema.parse(
        await request.json().catch(() => ({})),
      );

      return {
        data: await service.createMobileSession({
          appVersion: body.appVersion,
          deviceFingerprint: body.deviceFingerprint,
          deviceName: body.deviceName,
          email: body.email,
          ipAddress: context.ipAddress,
          mfaCode: body.mfaCode,
          password: body.password,
          platform: body.platform,
          userAgent: context.userAgent,
        }),
        status: 201,
      };
    },
    method: "POST",
    request,
    routeId: "createMobileSession",
  });
}
