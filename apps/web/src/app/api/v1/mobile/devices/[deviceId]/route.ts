import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await context.params;

  return handleApiRoute({
    handler: async ({ principal, service }) => {
      await service.revokeMobileDevice({
        deviceId,
        principal: principal!,
      });

      return {
        data: {
          revoked: true,
        },
      };
    },
    method: "DELETE",
    request,
    requiredScopes: ["mobile:devices"],
    routeId: "revokeMobileDevice",
  });
}
