import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;

  return handleApiRoute({
    handler: async ({ principal, service }) => ({
      data: await service.getOrganization({
        organizationId,
        principal: principal!,
      }),
      tenantId: organizationId,
    }),
    method: "GET",
    request,
    requiredScopes: ["tenant:read"],
    routeId: "getOrganization",
    tenantId: organizationId,
  });
}
