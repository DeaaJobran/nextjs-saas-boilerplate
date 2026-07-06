import { generateOpenApiSpec } from "@nextjs-saas/api/contracts";
import { appConfig } from "@nextjs-saas/config/app";

import { apiInfo, handleApiOptions, handleApiRoute } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export function GET(request: Request) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  return handleApiRoute({
    handler: () => ({
      data: generateOpenApiSpec({
        baseUrl,
        title: `${appConfig.name} API`,
        version: apiInfo().version,
      }),
    }),
    method: "GET",
    request,
    routeId: "getOpenApi",
  });
}
