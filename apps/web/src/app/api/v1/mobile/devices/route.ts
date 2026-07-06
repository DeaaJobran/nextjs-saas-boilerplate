import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export function GET(request: Request) {
  return handleApiRoute({
    handler: async ({ principal, service }) => ({
      data: {
        devices: await service.listMobileDevices({
          principal: principal!,
        }),
      },
    }),
    method: "GET",
    request,
    requiredScopes: ["mobile:devices"],
    routeId: "listMobileDevices",
  });
}
