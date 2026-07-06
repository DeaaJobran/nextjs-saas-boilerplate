import { generateOpenApiSpec } from "@nextjs-saas/api/contracts";
import { appConfig } from "@nextjs-saas/config/app";

import {
  apiInfo,
  getApiService,
  getRequestContext,
  handleApiOptions,
} from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(request: Request) {
  const service = getApiService();
  const startedAt = Date.now();
  const context = getRequestContext(request);
  const path = new URL(request.url).pathname;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const spec = generateOpenApiSpec({
    baseUrl,
    title: `${appConfig.name} API`,
    version: apiInfo().version,
  });

  await service.recordApiRequest({
    context,
    durationMs: Date.now() - startedAt,
    method: "GET",
    path,
    routeId: "getOpenApi",
    statusCode: 200,
  });

  return Response.json(spec, {
    headers: service.createCorsHeaders(request.headers.get("origin")),
  });
}
