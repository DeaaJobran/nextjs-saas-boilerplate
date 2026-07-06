import { handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export function GET(request: Request) {
  return handleApiRoute({
    handler: ({ service }) => ({
      data: {
        providers: service.listOAuthProviders(),
      },
    }),
    method: "GET",
    request,
    routeId: "listOAuthProviders",
  });
}
