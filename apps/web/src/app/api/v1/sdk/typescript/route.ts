import { generateTypeScriptSdk } from "@nextjs-saas/api/contracts";

import { getApiService, getRequestContext, handleApiOptions } from "@/lib/api";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(request: Request) {
  const service = getApiService();
  const context = getRequestContext(request);
  const startedAt = Date.now();

  await service.recordApiRequest({
    context,
    durationMs: Date.now() - startedAt,
    method: "GET",
    path: new URL(request.url).pathname,
    routeId: "getTypeScriptSdk",
    statusCode: 200,
  });

  return new Response(
    generateTypeScriptSdk({ packageName: "@nextjs-saas/api" }),
    {
      headers: {
        ...service.createCorsHeaders(request.headers.get("origin")),
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}
