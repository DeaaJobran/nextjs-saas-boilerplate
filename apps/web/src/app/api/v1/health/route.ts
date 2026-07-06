import { apiInfo, handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export function GET(request: Request) {
  return handleApiRoute({
    handler: () => ({
      data: {
        ...apiInfo(),
        status: "ok",
      },
    }),
    method: "GET",
    request,
    routeId: "getHealth",
  });
}
