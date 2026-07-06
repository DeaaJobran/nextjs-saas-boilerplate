import { completeMobileUploadSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;

  return handleApiRoute({
    handler: async ({ service }) => {
      const searchParams = new URL(request.url).searchParams;
      const jsonBody = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const body = completeMobileUploadSchema.parse({
        ...jsonBody,
        token: searchParams.get("token") ?? jsonBody.token,
      });

      return {
        data: await service.completeMobileUploadIntent({
          byteSize: body.byteSize,
          checksumSha256: body.checksumSha256,
          contentType: body.contentType,
          intentId,
          token: body.token,
        }),
      };
    },
    method: "PUT",
    request,
    routeId: "completeMobileUploadIntent",
  });
}
