import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export function GET(request: Request) {
  return handleApiRoute({
    authenticate: true,
    handler: ({ principal }) => ({
      data: {
        actorId: principal?.actorId,
        keyPrefix:
          principal && "keyPrefix" in principal
            ? principal.keyPrefix
            : undefined,
        mobileDeviceId:
          principal && "mobileDeviceId" in principal
            ? principal.mobileDeviceId
            : undefined,
        scopes: principal?.scopes ?? [],
        tenantId: principal?.tenantId,
        type: principal?.type,
      },
    }),
    method: "GET",
    request,
    requiredScopes: ["api:read"],
    routeId: "getMe",
  });
}
