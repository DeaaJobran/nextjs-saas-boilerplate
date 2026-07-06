import { mobileUploadIntentSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ principal, service }) => {
      const body = mobileUploadIntentSchema.parse(
        await request.json().catch(() => ({})),
      );

      return {
        data: await service.createMobileUploadIntent({
          byteSize: body.byteSize,
          checksumSha256: body.checksumSha256,
          contentType: body.contentType,
          fileName: body.fileName,
          metadata: body.metadata,
          principal: principal!,
          tenantId: body.tenantId,
        }),
        status: 201,
        tenantId: body.tenantId,
      };
    },
    method: "POST",
    request,
    requiredScopes: ["mobile:uploads"],
    routeId: "createMobileUploadIntent",
  });
}
